import { createHash } from 'node:crypto'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export function stableId(key) {
  const namespace = Buffer.from('6ba7b8109dad11d180b400c04fd430c8','hex')
  const b = createHash('sha1').update(namespace).update('chalkup:media:'+key).digest().subarray(0,16)
  b[6] = (b[6]&15)|0x50; b[8] = (b[8]&63)|0x80
  const s = b.toString('hex')
  return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`
}
const sqlString = value => "'" + String(value).replaceAll("'", "''") + "'"
const keyOf = e => JSON.stringify([e.category.toLowerCase(),e.muscle_group ?? e.group,e.name])
const digest = data => createHash('sha256').update(data).digest('hex')

export function reconcile(entries, catalog) {
  const index = new Map()
  for (const e of catalog) {
    if (e.coach_id !== null || e.is_custom !== false) continue
    const key = keyOf(e); index.set(key,[...(index.get(key)||[]),e])
  }
  const mapped = [], exceptions = [], used = new Set()
  for (const entry of entries) {
    const found = index.get(keyOf(entry)) || []
    if (found.length !== 1) {exceptions.push({entry_key:entry.entry_key,matches:found.length});continue}
    const live = found[0]
    if (used.has(live.id)) throw new Error('Multiple captured entries map to '+live.id)
    used.add(live.id)
    mapped.push({...entry,exercise_id:live.id,media_asset_id:stableId(entry.animation_key),
      description_changed:live.description !== entry.description})
  }
  return {mapped,exceptions,new_live_entries:catalog.filter(e=>e.coach_id===null && e.is_custom===false && !used.has(e.id))}
}

export async function prepareImport(manifestPath, catalogPath, outDir) {
  const manifest = JSON.parse(await readFile(manifestPath,'utf8'))
  const catalog = JSON.parse(await readFile(catalogPath,'utf8'))
  const mapping = reconcile(manifest.entries,catalog)
  if (mapping.exceptions.length || mapping.new_live_entries.length)
    throw new Error('Mapping requires review: '+JSON.stringify({exceptions:mapping.exceptions,new_live_entries:mapping.new_live_entries}))
  const animations = new Map(manifest.animations.map(a=>[a.asset_key,a]))
  const posters = new Map(manifest.posters.map(a=>[a.asset_key,a]))
  const assets = new Map(), versions = new Map(), files = new Map()
  const packageRoot = path.resolve(path.dirname(manifestPath))
  async function verifyFile(spec) {
    const filename = path.resolve(packageRoot,spec.path)
    if (filename === packageRoot || !filename.startsWith(packageRoot+path.sep)) throw new Error('Unsafe file path')
    const content = await readFile(filename)
    if (content.length !== spec.bytes || digest(content) !== spec.sha256) throw new Error('File hash/size mismatch: '+spec.path)
    return filename
  }
  for (const e of mapping.mapped) {
    const a=animations.get(e.animation_key),p=posters.get(e.poster_key)
    if (!a || !p || !a.validation.full_decode || !a.validation.all_pose_starts_and_midpoints_checked ||
        a.validation.max_pose_timing_error_ms > 1.01 || a.validation.end_time_ms !== a.duration_ms || !p.validation.decode)
      throw new Error('Missing or invalid technical validation: '+e.entry_key)
    if (a.review_flags.length || p.review_flags.length) throw new Error('Unresolved technical review flag: '+e.entry_key)
    const id=e.media_asset_id
    const versionId=stableId(`${e.animation_key}:${manifest.encoding_profile}:${a.sha256}:${p.sha256}`)
    if (versions.has(id) && versions.get(id).id!==versionId) throw new Error('Shared animation has different posters; reconcile first')
    assets.set(id,assets.get(id)||{id,asset_key:e.animation_key,title:e.name})
    versions.set(id,{id:versionId,media_asset_id:id,version_number:1,storage_bucket:'exercise-library',
      video_path:`library/animations/${a.sha256}.mp4`,poster_path:`library/posters/${p.sha256}.webp`,
      width:a.width,height:a.height,duration_ms:a.duration_ms,video_bytes:a.bytes,poster_bytes:p.bytes,
      video_sha256:a.sha256,poster_sha256:p.sha256,source_sha256:a.source_sha256,
      encoding_profile:manifest.encoding_profile,technical_status:'passed',technical_report:a.validation})
    for (const [spec,remote] of [[a,versions.get(id).video_path],[p,versions.get(id).poster_path]]) {
      if (!files.has(remote)) files.set(remote,{path:remote,local_path:await verifyFile(spec),sha256:spec.sha256,
        bytes:spec.bytes,mime_type:spec.mime_type,cache_control:'31536000',upsert:false})
    }
  }
  const aRows=[...assets.values()],vRows=[...versions.values()]
  const eRows=mapping.mapped.map(e=>({exercise_id:e.exercise_id,media_asset_id:e.media_asset_id,
    name:e.name,category:e.category.toLowerCase(),muscle_group:e.group,note:e.demonstration_note || null}))
  const sql=`-- Generated draft-only import. No uploads, approvals, or publication occur here.
-- Rechecks exact identities and refuses to replace existing different links/notes.
begin;
create temporary table _media_import_assets on commit drop as
select * from jsonb_to_recordset(${sqlString(JSON.stringify(aRows))}::jsonb)
  as x(id uuid,asset_key text,title text);
create temporary table _media_import_versions on commit drop as
select * from jsonb_to_recordset(${sqlString(JSON.stringify(vRows))}::jsonb)
  as x(id uuid,media_asset_id uuid,version_number integer,storage_bucket text,video_path text,poster_path text,
       width integer,height integer,duration_ms integer,video_bytes bigint,poster_bytes bigint,
       video_sha256 text,poster_sha256 text,source_sha256 text,encoding_profile text,technical_status text,technical_report jsonb);
create temporary table _media_import_links on commit drop as
select * from jsonb_to_recordset(${sqlString(JSON.stringify(eRows))}::jsonb)
  as x(exercise_id uuid,media_asset_id uuid,name text,category text,muscle_group text,note text);
do $$ begin
  if exists(select 1 from _media_import_links i left join public.exercises e on e.id=i.exercise_id
    where e.id is null or e.name<>i.name or e.category::text<>i.category or e.muscle_group::text<>i.muscle_group
      or e.coach_id is not null or e.is_custom
      or (e.default_media_asset_id is not null and e.default_media_asset_id<>i.media_asset_id)
      or (e.media_demonstration_note is not null and e.media_demonstration_note is distinct from i.note)) then
    raise exception 'Exercise identity, link, or note changed; regenerate and review mapping';
  end if;
end $$;
insert into public.media_assets(id,asset_key,title) select id,asset_key,title from _media_import_assets
  on conflict(id) do nothing;
do $$ begin
  if exists(select 1 from _media_import_assets i join public.media_assets a using(id)
    where a.asset_key<>i.asset_key or a.owner_coach_id is not null or a.archived_at is not null) then
    raise exception 'Existing asset identity changed';
  end if;
end $$;
insert into public.media_asset_versions(id,media_asset_id,version_number,storage_bucket,video_path,poster_path,
    width,height,duration_ms,video_bytes,poster_bytes,video_sha256,poster_sha256,source_sha256,
    encoding_profile,technical_status,technical_report)
  select id,media_asset_id,version_number,storage_bucket,video_path,poster_path,width,height,duration_ms,
    video_bytes,poster_bytes,video_sha256,poster_sha256,source_sha256,encoding_profile,technical_status,technical_report
  from _media_import_versions on conflict(id) do nothing;
do $$ begin
  if exists(select 1 from _media_import_versions i join public.media_asset_versions v using(id)
    where row(v.media_asset_id,v.version_number,v.storage_bucket,v.video_path,v.poster_path,v.video_sha256,v.poster_sha256,
              v.source_sha256,v.encoding_profile,v.width,v.height,v.duration_ms,v.video_bytes,v.poster_bytes)
      is distinct from row(i.media_asset_id,i.version_number,i.storage_bucket,i.video_path,i.poster_path,i.video_sha256,
              i.poster_sha256,i.source_sha256,i.encoding_profile,i.width,i.height,i.duration_ms,i.video_bytes,i.poster_bytes)) then
    raise exception 'Imported version differs from existing version; review before replacing';
  end if;
end $$;
update public.exercises e set default_media_asset_id=i.media_asset_id,
  media_demonstration_note=coalesce(e.media_demonstration_note,i.note)
from _media_import_links i where e.id=i.exercise_id and
  (e.default_media_asset_id is null or (e.media_demonstration_note is null and i.note is not null));
commit;
`
  await mkdir(outDir,{recursive:true})
  const write=async(name,value)=>writeFile(path.join(outDir,name),JSON.stringify(value,null,2)+'\n')
  await writeFile(path.join(outDir,'import-drafts.sql'),sql)
  await write('exercise-id-crosswalk.json',mapping.mapped)
  await write('upload-plan.json',{bucket:'exercise-library',versions:vRows.map(v=>({
    id:v.id,media_asset_id:v.media_asset_id,video_path:v.video_path,poster_path:v.poster_path,
    video_sha256:v.video_sha256,poster_sha256:v.poster_sha256,video_bytes:v.video_bytes,poster_bytes:v.poster_bytes
  })),files:[...files.values()],
    required_before_upload:'Explicit content approval for referenced versions. Drafts stay local/private.',
    required_before_publication:'Upload each unique path without upsert; download and verify hash, size and MIME; record files_verified_at; publish approved versions with expected pointer.'})
  const report={matched_exercises:mapping.mapped.length,assets:aRows.length,versions:vRows.length,
    unique_upload_files:files.size,unique_upload_bytes:[...files.values()].reduce((n,f)=>n+f.bytes,0),
    description_changes:mapping.mapped.filter(e=>e.description_changed).map(e=>e.entry_key),
    exceptions:mapping.exceptions,new_live_entries:mapping.new_live_entries,
    publication:'none; draft metadata only',live_database_changed:false}
  await write('import-report.json',report)
  return report
}

if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const args=process.argv.slice(2)
  if(args.length!==3) throw new Error('Usage: node prepare-import.mjs <package/manifest.json> <live-system-catalog.json> <out-dir>')
  console.log(JSON.stringify(await prepareImport(...args),null,2))
}
