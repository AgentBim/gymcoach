// Server/operator-only tool. No credentials, uploads or publication occur in dry run.
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const hash=b=>createHash('sha256').update(b).digest('hex')
const missing=error=>String(error.statusCode)==='404' || error.message==='Object not found'

export async function boundedEach(items,concurrency,task) {
  if(!Number.isInteger(concurrency)||concurrency<1||concurrency>4)throw new Error('Upload concurrency must be 1–4')
  let cursor=0,failure=null
  await Promise.all(Array.from({length:Math.min(concurrency,items.length)},async()=>{
    while(!failure&&cursor<items.length){const item=items[cursor++];try{await task(item)}catch(error){failure ||= error}}
  }))
  if(failure)throw failure
}

export async function uploadApprovedFiles({plan,versionIds,readVersions,storage,markVerified,concurrency=1,onProgress=()=>{}}) {
  if(!Number.isInteger(concurrency)||concurrency<1||concurrency>4)throw new Error('Upload concurrency must be 1–4')
  if(plan.bucket!=='exercise-library')throw new Error('Unexpected media bucket')
  const selected=plan.versions.filter(v=>!versionIds||versionIds.includes(v.id))
  if(!selected.length || (versionIds && new Set(versionIds).size!==selected.length))throw new Error('Unknown or empty version selection')
  const approved=await readVersions(selected.map(v=>v.id))
  for(const v of selected){
    const live=approved.find(a=>a.id===v.id)
    if(!live || live.content_review_status!=='approved' || live.technical_status!=='passed' ||
       !live.approved_at || !live.approved_by?.trim())throw new Error('Version requires explicit content approval: '+v.id)
    for(const key of ['media_asset_id','video_path','poster_path','video_sha256','poster_sha256','video_bytes','poster_bytes'])
      if(live[key]!==v[key])throw new Error('Version changed since import plan: '+v.id)
  }
  const required=new Set(selected.flatMap(v=>[v.video_path,v.poster_path]))
  const files=plan.files.filter(f=>required.has(f.path))
  if(files.length!==required.size || new Set(files.map(f=>f.path)).size!==files.length)throw new Error('Incomplete or duplicate upload paths')
  const local=new Map()
  // Validate all local inputs and the approval set before the first storage write.
  for(const f of files){
    const ext=f.mime_type==='video/mp4'?'mp4':f.mime_type==='image/webp'?'webp':null
    const folder=ext==='mp4'?'animations':'posters'
    if(!ext || f.path!==`library/${folder}/${f.sha256}.${ext}` || !/^[0-9a-f]{64}$/.test(f.sha256))
      throw new Error('Invalid content-addressed path/MIME')
    const content=await readFile(f.local_path)
    if(content.length!==f.bytes || hash(content)!==f.sha256)throw new Error('Local file hash/size mismatch')
    for(const v of selected){
      const kind=v.video_path===f.path?'video':v.poster_path===f.path?'poster':null
      if(kind && (v[kind+'_sha256']!==f.sha256 || v[kind+'_bytes']!==f.bytes))throw new Error('Plan file/version mismatch')
    }
    local.set(f.path,content)
  }
  const bucket=await storage.getBucket(plan.bucket)
  if(bucket.error || !bucket.data?.public)throw new Error('An explicitly configured public exercise-library bucket is required')
  const api=storage.from(plan.bucket)
  let uploaded=0,reused=0,completed=0
  await boundedEach(files,concurrency,async f=>{
    let remote=await api.download(f.path)
    if(remote.error){
      if(!missing(remote.error))throw new Error('Cannot check existing object: '+f.path)
      const result=await api.upload(f.path,local.get(f.path),{contentType:f.mime_type,cacheControl:'31536000',upsert:false})
      if(result.error)throw new Error('Upload failed; rerun safely without overwrite: '+f.path)
      uploaded++
      remote=await api.download(f.path)
    }else reused++
    if(remote.error || !remote.data)throw new Error('Cannot verify remote object: '+f.path)
    const downloaded=Buffer.from(await remote.data.arrayBuffer())
    if(hash(downloaded)!==f.sha256 || downloaded.length!==f.bytes || remote.data.type.split(';')[0]!==f.mime_type)
      throw new Error('Remote bytes or MIME differ; object was not overwritten: '+f.path)
    onProgress({completed:++completed,total:files.length})
  })
  // A failed/partial upload never marks a version verified. A rerun rechecks
  // existing hashes and can finish without replacing previously uploaded objects.
  await boundedEach(selected,concurrency,markVerified)
  return {versions_verified:selected.length,uploaded_files:uploaded,reused_files:reused,published_versions:0}
}

async function main(){
  const args=process.argv.slice(2),filename=args[0]
  if(!filename)throw new Error('Usage: node upload-approved.mjs <upload-plan.json> [--versions <ids.json>] [--apply --expected-project <ref>]')
  const flag=name=>{const i=args.indexOf(name);return i<0?null:args[i+1]}
  const plan=JSON.parse(await readFile(filename,'utf8'))
  const selection=flag('--versions'),versionIds=selection?JSON.parse(await readFile(selection,'utf8')):null
  if(!args.includes('--apply')){
    console.log(JSON.stringify({mode:'dry_run',bucket:plan.bucket,planned_versions:versionIds?.length??plan.versions.length,
      total_unique_files:plan.files.length,publication:'none',required:'Content approval in target database, configured public bucket, service credential, expected target project.'},null,2));return
  }
  const expected=flag('--expected-project'),url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!expected || !url || !key || new URL(url).origin!==`https://${expected}.supabase.co`)
    throw new Error('Explicit expected project and matching server-only SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are required')
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
  const readVersions=async ids=>{
    const result=[]
    for(let i=0;i<ids.length;i+=40){
      const {data,error}=await client.from('media_asset_versions').select('id,media_asset_id,video_path,poster_path,video_sha256,poster_sha256,video_bytes,poster_bytes,technical_status,content_review_status,approved_at,approved_by').in('id',ids.slice(i,i+40))
      if(error)throw new Error('Could not read approved versions');result.push(...data)
    }
    return result
  }
  const markVerified=async v=>{
    const {data,error}=await client.from('media_asset_versions').update({files_verified_at:new Date().toISOString()})
      .eq('id',v.id).eq('content_review_status','approved').eq('technical_status','passed')
      .eq('video_sha256',v.video_sha256).eq('poster_sha256',v.poster_sha256).select('id')
    if(error || data?.length!==1)throw new Error('Approval changed; version not marked verified: '+v.id)
  }
  console.log(JSON.stringify(await uploadApprovedFiles({plan,versionIds,readVersions,storage:client.storage,markVerified}),null,2))
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await main()
