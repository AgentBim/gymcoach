import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { uploadApprovedFiles } from './upload-approved.mjs'

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const plan=JSON.parse(await readFile(path.join(repo,'.media-test-output/upload-plan.json'),'utf8'))
const selected=plan.versions.slice(0,2),versionIds=selected.map(v=>v.id)
const objects=new Map(),marked=[],checks=[]
let uploads=0,failAt=0,privateBucket=false,readError=null,approval='approved'
const storage={
  getBucket:async()=>({data:{public:!privateBucket},error:null}),
  from:()=>({
    download:async name=>{
      if(readError)return {data:null,error:readError}
      const value=objects.get(name)
      return value?{data:new Blob([value.bytes],{type:value.mime}),error:null}:{data:null,error:{statusCode:'404',message:'Object not found'}}
    },
    upload:async(name,bytes,options)=>{
      assert.equal(options.upsert,false)
      if(objects.has(name))throw new Error('Test caught an attempted overwrite')
      uploads++
      if(uploads===failAt)return {error:{message:'Synthetic interrupted upload'}}
      objects.set(name,{bytes:Buffer.from(bytes),mime:options.contentType});return {error:null}
    }
  })
}
const readVersions=async()=>selected.map(v=>({...v,technical_status:'passed',content_review_status:approval,approved_at:'2026-10-17T00:00:00Z',approved_by:'synthetic-test-only'}))
const markVerified=async v=>marked.push(v.id)
const run=extra=>uploadApprovedFiles({plan,versionIds,readVersions,storage,markVerified,...extra})
async function check(label,fn){await fn();checks.push(label);console.log('PASS '+label)}
await check('unapproved versions cannot upload any public files',async()=>{
  approval='pending';await assert.rejects(run(),/explicit content approval/);assert.equal(objects.size,0);assert.equal(marked.length,0);approval='approved'
})
await check('an interrupted upload records no verified version and resumes without overwrite',async()=>{
  failAt=2;await assert.rejects(run(),/Upload failed/);assert.equal(objects.size,1);assert.equal(marked.length,0)
  failAt=0;const result=await run();assert.equal(result.reused_files,1);assert.equal(result.versions_verified,2);assert.equal(result.published_versions,0)
})
await check('a completed rerun verifies and reuses every existing file without uploading again',async()=>{
  const count=uploads;marked.length=0;const result=await run();assert.equal(result.uploaded_files,0);assert.equal(uploads,count);assert.equal(result.reused_files,objects.size);assert.equal(marked.length,2)
})
await check('corrupted existing bytes are rejected without overwriting the object',async()=>{
  const key=selected[0].video_path,original=objects.get(key);objects.set(key,{bytes:Buffer.from('bad bytes'),mime:'video/mp4'});marked.length=0
  await assert.rejects(run(),/Remote bytes or MIME differ/);assert.equal(marked.length,0);assert.equal(objects.get(key).bytes.toString(),'bad bytes');objects.set(key,original)
})
await check('incorrect remote content types fail verification',async()=>{
  const key=selected[0].video_path,original=objects.get(key);objects.set(key,{...original,mime:'application/octet-stream'});marked.length=0
  await assert.rejects(run(),/Remote bytes or MIME differ/);assert.equal(marked.length,0);objects.set(key,original)
})
await check('permission errors are never mistaken for missing objects',async()=>{
  readError={statusCode:'403',message:'Forbidden'};const before=uploads;await assert.rejects(run(),/Cannot check existing/);assert.equal(uploads,before);readError=null
})
await check('changed database versions and corrupted local plans are rejected before writes',async()=>{
  const before=uploads
  await assert.rejects(run({readVersions:async()=>selected.map(v=>({...v,technical_status:'passed',content_review_status:'approved',approved_at:'test',approved_by:'test',video_bytes:v.video_bytes+1}))}),/Version changed/)
  const changed=structuredClone(plan);changed.files.find(f=>f.path===selected[0].video_path).bytes++
  await assert.rejects(run({plan:changed}),/Local file hash/);assert.equal(uploads,before)
})
await check('unknown versions and a private bucket cannot accidentally trigger uploads',async()=>{
  await assert.rejects(run({versionIds:['unknown']}),/Unknown or empty/)
  privateBucket=true;const before=uploads;await assert.rejects(run(),/public exercise-library bucket/);assert.equal(uploads,before);privateBucket=false
})
const result={status:'pass',checks,transport:'In-memory storage adapter with real package bytes; no remote API calls',
  scope:'Approval gating, interrupted uploads, idempotency, existing-object integrity, MIME and local-hash checks. Hosted Storage integration remains pending.'}
await writeFile(path.join(repo,'.media-test-output/upload-test-results.json'),JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify(result,null,2))
