import { readFile,writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { uploadApprovedFiles } from './upload-approved.mjs';
const [planFile,idsFile,capabilityFile,reportFile,expectedProject]=process.argv.slice(2);
const plan=JSON.parse(await readFile(planFile,'utf8'));
const ids=JSON.parse((await readFile(idsFile,'utf8')).replace(/^\uFEFF/,''));
const access=JSON.parse(await readFile(capabilityFile,'utf8'));
if(!['vlladyjynzmkswvnelku','nqrlhotrwyrphwumxtty'].includes(expectedProject)||access.projectRef!==expectedProject||Date.now()>=access.expiresAt||ids.length<1||ids.length>40||new Set(ids).size!==ids.length)throw Error('Explicit matching expected project and 1–40 version IDs required');
const url=`https://${expectedProject}.supabase.co`;
const client=createClient(url,access.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
async function call(body) {
  const r=await fetch(`${url}/functions/v1/chalkup-library-media-upload`,{method:'POST',headers:{Authorization:`Bearer ${access.anonKey}`,'Content-Type':'application/json','x-upload-capability':access.token},body:JSON.stringify(body)});
  if(!r.ok)throw Error(`Test upload bridge returned ${r.status}`);
  return r.json();
}
const storage={
  getBucket:async()=>({data:(await call({action:'bucket'})).bucket}),
  from:()=>({
    download:async path=>{
      const r=await fetch(`${url}/storage/v1/object/public/exercise-library/${path}`);
      if(r.status===404||r.status===400)return {error:{statusCode:404,message:'Object not found'}};
      if(!r.ok)return {error:{statusCode:r.status,message:'Download failed'}};
      return {data:await r.blob()};
    },
    upload:async(path,bytes,options)=>{
      const signed=await call({action:'sign',path});
      if(signed.path!==path)throw Error('Unexpected upload destination');
      return client.storage.from('exercise-library').uploadToSignedUrl(path,signed.token,bytes,options);
    }
  })
};
const result=await uploadApprovedFiles({plan,versionIds:ids,concurrency:4,onProgress:({completed,total})=>{if(completed%10===0||completed===total)console.log(JSON.stringify({files_verified:completed,total}));},readVersions:async()=> (await call({action:'versions'})).versions,storage,markVerified:async v=>{await call({action:'verify',id:v.id});}});
await writeFile(reportFile,JSON.stringify({...result,project_ref:access.projectRef,finished_at:new Date().toISOString()},null,2));
console.log(JSON.stringify(result));
