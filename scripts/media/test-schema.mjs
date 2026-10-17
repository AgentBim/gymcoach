import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { prepareImport, reconcile, stableId } from './prepare-import.mjs'

const here=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(here,'../..')
const manifestPath=path.resolve(process.argv[2] || path.join(repo,'../media-compression/package/manifest.json'))
const out=path.join(repo,'.media-test-output')
await mkdir(out,{recursive:true})
const manifest=JSON.parse(await readFile(manifestPath,'utf8'))
const catalog=JSON.parse(await readFile(path.join(here,'fixtures/catalog.json'),'utf8'))
const db=new PGlite()
let assertions=0
const checks=[]
async function check(label,fn){await fn();checks.push(label);console.log('PASS '+label)}
function equal(a,b){assert.deepEqual(a,b);assertions++}
async function rows(sql,args=[]){return (await db.query(sql,args)).rows}
async function scalar(sql,args=[]){return Object.values((await rows(sql,args))[0])[0]}
async function denied(sql,pattern=/permission denied/){
  try{await db.exec(sql)}catch(error){assert.match(error.message,pattern);assertions++;return}
  throw new Error('Expected denial: '+sql.slice(0,130))
}
async function role(name,uid=''){
  await db.exec(`reset role; set role ${name};`)
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid])
}
const coach='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002'
const athlete='10000000-0000-4000-8000-000000000003',ath='10000000-0000-4000-8000-000000000004'
const workout='20000000-0000-4000-8000-000000000001',assignment='30000000-0000-4000-8000-000000000001'
const leg=catalog.find(e=>e.category==='strength'&&e.muscle_group==='Legs')
const prehab=catalog.find(e=>e.category==='prehab')
const token='a'.repeat(64)
try {
  await db.exec(await readFile(path.join(here,'fixtures/baseline.sql'),'utf8'))
  await db.query(`insert into public.exercises(id,name,category,muscle_group,difficulty,description,is_custom)
    select id,name,category::public.exercise_category,muscle_group::public.muscle_group,
      difficulty::public.difficulty_level,description,is_custom
    from jsonb_to_recordset($1::jsonb) x(id uuid,name text,category text,muscle_group text,difficulty text,description text,is_custom boolean)`,[JSON.stringify(catalog)])
  await db.exec(`insert into auth.users(id) values('${coach}'),('${other}'),('${athlete}');
    insert into public.coaches(id,full_name,email) values('${coach}','Test coach','coach@example.test'),('${other}','Other coach','other@example.test');
    insert into public.athletes(id,coach_id,full_name,user_id) values('${ath}','${coach}','Test athlete','${athlete}');
    insert into public.workouts(id,coach_id,name,share_token) values('${workout}','${coach}','Synthetic media test','synthetic-workout-token');
    insert into public.workout_exercises(workout_id,exercise_id,sets,reps,rest_seconds) values('${workout}','${leg.id}',3,10,30);
    insert into public.workout_prehab(workout_id,exercise_id) values('${workout}','${prehab.id}');
    insert into public.workout_assignments(id,workout_id,athlete_id,coach_id,assignment_token)
      values('${assignment}','${workout}','${ath}','${coach}','${token}');`)
  const before=await scalar(`select public.get_shared_workout('${token}')`)
  const ids=await rows('select id,name,description,default_sets,default_reps,default_duration_seconds,default_rest_seconds from public.exercises order by id')
  const migration=(await readdir(path.join(repo,'supabase/migrations'))).find(f=>f.endsWith('_exercise_media.sql'))
  await check('migration applies to inspected schema without changing existing exercise/workout data',async()=>{
    await db.exec(await readFile(path.join(repo,'supabase/migrations',migration),'utf8'))
    equal(await rows('select id,name,description,default_sets,default_reps,default_duration_seconds,default_rest_seconds from public.exercises order by id'),ids)
    equal(await scalar('select count(*)::int from public.workout_exercises'),1)
    equal(await scalar('select count(*)::int from public.workout_prehab'),1)
  })
  let importSql
  await check('full 280-entry import is verified, draft-only and idempotent',async()=>{
    const result=await prepareImport(manifestPath,path.join(here,'fixtures/catalog.json'),out)
    equal([result.matched_exercises,result.assets,result.unique_upload_files],[280,248,495])
    importSql=await readFile(path.join(out,'import-drafts.sql'),'utf8')
    await role('service_role');await db.exec(importSql);await db.exec(importSql)
    equal(await scalar('select count(*)::int from public.media_assets'),248)
    equal(await scalar('select count(*)::int from public.media_asset_versions'),248)
    equal(await scalar('select count(*)::int from public.exercises where default_media_asset_id is not null'),280)
    equal(await scalar('select count(*)::int from public.media_assets where published_version_id is not null'),0)
    equal(await scalar("select count(*)::int from public.media_asset_versions where content_review_status<>'pending' or files_verified_at is not null"),0)
  })
  const mapped=JSON.parse(await readFile(path.join(out,'exercise-id-crosswalk.json'),'utf8'))
  const target=mapped.find(e=>e.exercise_id===leg.id),aid=target.media_asset_id
  await role('service_role')
  const vid=await scalar(`select id from public.media_asset_versions where media_asset_id='${aid}'`)
  await check('ordinary coach and athlete cannot see drafts or modify shared media',async()=>{
    for(const uid of [coach,other,athlete]){
      await role('authenticated',uid)
      equal(await scalar('select count(*)::int from public.exercise_media'),0)
      equal(await scalar('select count(*)::int from public.media_assets'),0)
      await denied("insert into public.media_assets(asset_key,title) values('forbidden','forbidden')")
      await denied("update public.media_asset_versions set content_review_status='approved'")
      await denied(`select public.publish_media_asset('${aid}','${vid}',null)`)
    }
    await role('anon')
    await denied('select * from public.exercise_media')
    await denied('select name from public.exercises')
    await denied(`select public.publish_media_asset('${aid}','${vid}',null)`)
    await denied("insert into public.media_assets(asset_key,title) values('forbidden','forbidden')")
  })
  await check('publication requires content approval AND verified uploads, with no privilege escalation',async()=>{
    await role('service_role')
    await denied(`select public.publish_media_asset('${aid}','${vid}',null)`,/not approved/)
    await db.exec(`update public.media_asset_versions set content_review_status='approved',approved_by='synthetic-test-only',approved_at=now() where id='${vid}'`)
    await denied(`select public.publish_media_asset('${aid}','${vid}',null)`,/not approved/)
    await db.exec(`update public.media_asset_versions set files_verified_at=now() where id='${vid}'`)
    await db.exec(`select public.publish_media_asset('${aid}','${vid}',null)`)
    equal(await scalar(`select publication_revision from public.media_assets where id='${aid}'`),1)
    await role('authenticated',coach)
    equal(await scalar(`select count(*)::int from public.exercise_media where exercise_id='${leg.id}'`),1)
    await denied('select technical_report from public.media_asset_versions')
    await denied('select approved_by from public.media_asset_versions')
    await denied('select publication_history from public.media_assets')
    await denied('delete from public.media_assets')
  })
  await check('published content is visible to authenticated athletes; custom exercise isolation remains',async()=>{
    await role('authenticated',other)
    const custom='40000000-0000-4000-8000-000000000001'
    await db.exec(`insert into public.exercises(id,name,description,muscle_group,difficulty,coach_id,is_custom,default_media_asset_id)
      values('${custom}','Other coach custom','Synthetic test','Legs','Easy','${other}',true,'${aid}')`)
    equal(await scalar(`select count(*)::int from public.exercise_media where exercise_id='${custom}'`),1)
    await role('authenticated',athlete)
    equal(await scalar(`select count(*)::int from public.exercise_media where exercise_id='${leg.id}'`),1)
    equal(await scalar(`select count(*)::int from public.exercise_media where exercise_id='${custom}'`),0)
    const r=reconcile(manifest.entries,[...catalog,{...leg,id:custom,coach_id:other,is_custom:true}])
    equal(r.exceptions.length,0);equal(r.mapped.length,280)
  })
  await check('UUID mapping refuses duplicates or missing matches; shared aliases preserve distinct notes',async()=>{
    equal(reconcile(manifest.entries,[...catalog,{...leg,id:'40000000-0000-4000-8000-000000000002'}]).exceptions.length,1)
    equal(reconcile(manifest.entries,catalog.filter(e=>e.id!==leg.id)).exceptions.length,1)
    const hang=mapped.find(e=>e.entry_key==='arms/hang-to-row'),row=mapped.find(e=>e.entry_key==='back/inverted-row')
    equal(hang.media_asset_id,row.media_asset_id)
    assert.notEqual(hang.demonstration_note,row.demonstration_note);assertions++
    await role('service_role')
    for(const e of [hang,row]) equal(await scalar(`select media_demonstration_note from public.exercises where id='${e.exercise_id}'`),e.demonstration_note)
  })
  await check('shared-token RPC adds only approved metadata and keeps existing payload/guards',async()=>{
    await role('anon')
    const after=await scalar(`select public.get_shared_workout('${token}')`)
    equal(after.exercises[0].exercises.id,leg.id)
    equal(after.exercises[0].exercises.media.media_asset_id,aid)
    equal(after.prehab[0].exercises.media,null)
    const mediaKeys=Object.keys(after.exercises[0].exercises.media).sort()
    equal(mediaKeys,['media_asset_id','version_id','publication_revision','storage_bucket','video_path','poster_path','width','height','duration_ms','demonstration_note','exercise_note'].sort())
    const stripped=structuredClone(after)
    for(const [type,list] of Object.entries({exercises:stripped.exercises,prehab:stripped.prehab}))
      for(const item of list){delete item.exercises.id;delete item.exercises.media;if(type==='exercises')delete item.exercises.category}
    equal(stripped,before)
    for(const invalid of ['bad','b'.repeat(64),'A'.repeat(64)])equal(await scalar(`select public.get_shared_workout('${invalid}')`),null)
    await role('service_role');await db.exec(`update public.workout_assignments set revoked_at=now() where id='${assignment}'`)
    await role('anon');equal(await scalar(`select public.get_shared_workout('${token}')`),null)
    await role('service_role');await db.exec(`update public.workout_assignments set revoked_at=null,expires_at=now()-interval '1 second' where id='${assignment}'`)
    await role('anon');equal(await scalar(`select public.get_shared_workout('${token}')`),null)
    await role('service_role');await db.exec(`update public.workout_assignments set expires_at=now()+interval '1 day' where id='${assignment}'`)
  })
  await check('immutable files, same-asset pointers and referenced-record deletion are enforced',async()=>{
    await role('service_role')
    await denied(`update public.media_asset_versions set duration_ms=123 where id='${vid}'`,/immutable/)
    await denied(`update public.media_asset_versions set video_path='../escape.mp4' where id='${vid}'`,/immutable/)
    const otherAsset=mapped.find(e=>e.media_asset_id!==aid).media_asset_id
    await denied(`update public.media_assets set published_version_id='${vid}' where id='${otherAsset}'`,/same asset/)
    await denied(`delete from public.media_assets where id='${aid}'`,/foreign key/)
    await denied(`delete from public.media_asset_versions where id='${vid}'`,/foreign key/)
    await denied(`update public.media_asset_versions set width=0 where id='${vid}'`,/immutable|check constraint/)
  })
  const version2=stableId('synthetic-version-2')
  await check('version replacement, stale-publish protection, rollback and unpublish work',async()=>{
    await role('service_role')
    await db.exec(`insert into public.media_asset_versions(id,media_asset_id,version_number,storage_bucket,video_path,poster_path,width,height,duration_ms,
      video_bytes,poster_bytes,video_sha256,poster_sha256,source_sha256,encoding_profile,technical_status,content_review_status,approved_by,approved_at,files_verified_at)
      select '${version2}',media_asset_id,2,storage_bucket,video_path,poster_path,width,height,duration_ms,video_bytes,poster_bytes,video_sha256,
      poster_sha256,source_sha256,encoding_profile,'passed','approved','synthetic-test-only',now(),now() from public.media_asset_versions where id='${vid}'`)
    await db.exec(`select public.publish_media_asset('${aid}','${version2}','${vid}')`)
    await denied(`select public.publish_media_asset('${aid}','${vid}','${vid}')`,/changed/)
    await db.exec(`select public.publish_media_asset('${aid}','${vid}','${version2}')`)
    equal(await scalar(`select publication_revision from public.media_assets where id='${aid}'`),3)
    await db.exec(`select public.publish_media_asset('${aid}',null,'${vid}')`)
    await role('anon')
    equal((await scalar(`select public.get_shared_workout('${token}')`)).exercises[0].exercises.media,null)
    await role('service_role');await db.exec(`select public.publish_media_asset('${aid}','${vid}',null)`)
  })
  await check('repeated import preserves reviewed metadata and published pointers',async()=>{
    await role('service_role');await db.exec(importSql)
    equal(await scalar('select count(*)::int from public.media_assets'),248)
    equal(await scalar('select count(*)::int from public.media_asset_versions'),249)
    equal(await scalar(`select published_version_id from public.media_assets where id='${aid}'`),vid)
    equal(await scalar(`select content_review_status from public.media_asset_versions where id='${vid}'`),'approved')
    equal(await scalar(`select publication_revision from public.media_assets where id='${aid}'`),5)
  })
  await check('changed catalog identities abort imports atomically instead of silently remapping',async()=>{
    await role('service_role')
    await db.exec(`update public.exercises set name='Synthetic renamed entry' where id='${leg.id}'`)
    await denied(importSql,/identity, link, or note changed/)
    await db.exec('rollback')
    equal(await scalar(`select published_version_id from public.media_assets where id='${aid}'`),vid)
    equal(await scalar('select count(*)::int from public.media_assets'),248)
    await db.query('update public.exercises set name=$1 where id=$2',[leg.name,leg.id])
  })
  await check('Prehab metadata reaches the same token-checked route after its separate approval',async()=>{
    await role('service_role')
    const p=mapped.find(e=>e.exercise_id===prehab.id)
    const version=await scalar(`select id from public.media_asset_versions where media_asset_id='${p.media_asset_id}'`)
    await db.exec(`update public.media_asset_versions set content_review_status='approved',approved_by='synthetic-test-only',approved_at=now(),files_verified_at=now() where id='${version}'`)
    await db.exec(`select public.publish_media_asset('${p.media_asset_id}','${version}',null)`)
    await role('anon')
    const payload=await scalar(`select public.get_shared_workout('${token}')`)
    equal(payload.prehab[0].exercises.media.media_asset_id,p.media_asset_id)
    equal(payload.prehab[0].exercises.id,prehab.id)
    equal(payload.prehab[0].sets,before.prehab[0].sets)
  })
  await check('new tables have RLS, selective grants, fixed function search paths and an invoker view',async()=>{
    await db.exec('reset role')
    equal(await scalar("select bool_and(relrowsecurity) from pg_class where oid in ('public.media_assets'::regclass,'public.media_asset_versions'::regclass)"),true)
    equal(await scalar("select bool_and(not has_table_privilege(r,t,'INSERT') and not has_table_privilege(r,t,'UPDATE') and not has_table_privilege(r,t,'DELETE')) from unnest(array['anon','authenticated'])r cross join unnest(array['public.media_assets','public.media_asset_versions'])t"),true)
    equal(await scalar("select reloptions @> array['security_invoker=true'] from pg_class where oid='public.exercise_media'::regclass"),true)
    equal(await scalar("select bool_and(not prosecdef) from pg_proc where proname in ('publish_media_asset','guard_media_version_immutability','guard_media_publication')"),true)
    equal(await scalar("select count(*)::int from pg_indexes where schemaname='public' and indexname in ('media_assets_owner_idx','media_assets_published_version_idx','exercises_default_media_asset_idx')"),3)
  })
  await check('archived, rejected and failed media hide cleanly without removing exercises',async()=>{
    await role('service_role');await db.exec(`update public.media_assets set archived_at=now() where id='${aid}'`)
    await role('anon');equal((await scalar(`select public.get_shared_workout('${token}')`)).exercises.length,1)
    equal((await scalar(`select public.get_shared_workout('${token}')`)).exercises[0].exercises.media,null)
    await role('service_role');await db.exec(`update public.media_assets set archived_at=null where id='${aid}';update public.media_asset_versions set content_review_status='rejected' where id='${vid}'`)
    await role('authenticated',athlete);equal(await scalar(`select count(*)::int from public.exercise_media where exercise_id='${leg.id}'`),0)
    await role('service_role');await db.exec(`update public.media_asset_versions set content_review_status='approved',technical_status='failed' where id='${vid}'`)
    await role('authenticated',coach);equal(await scalar(`select count(*)::int from public.exercise_media where exercise_id='${leg.id}'`),0)
  })
  const report={status:'pass',runtime:'PGlite PostgreSQL; synthetic auth claims and data; no live writes',assertions,checks,
    scope:'DDL, constraints, RLS/grants, full import, UUID mapping and token RPC. Supabase HTTP/Auth/Storage delivery remains a later integration check.'}
  await writeFile(path.join(out,'schema-test-results.json'),JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify(report,null,2))
} finally {await db.close()}
