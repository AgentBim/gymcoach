// Operator-only, short-lived, project-pinned upload capability. Never imported by Vite.
const fields='id,media_asset_id,video_path,poster_path,video_sha256,poster_sha256,video_bytes,poster_bytes,technical_status,content_review_status,approved_at,approved_by';
const sha=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',value))).map(x=>x.toString(16).padStart(2,'0')).join('');
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export function createUploadBridge({client,config,url,now=Date.now}) {
  const ids=new Set(config.versionIds);
  async function approved() {
    const {data,error}=await client.from('media_asset_versions').select(fields).in('id',[...ids]);
    if(error||data?.length!==ids.size||!data.every(v=>ids.has(v.id)&&v.technical_status==='passed'&&v.content_review_status==='approved'&&v.approved_by?.trim()&&v.approved_at))throw Error('Approval set changed');
    for(const v of data) for(const kind of ['video','poster']) {
      const ext=kind==='video'?'mp4':'webp',folder=kind==='video'?'animations':'posters';
      if(!/^[0-9a-f]{64}$/.test(v[kind+'_sha256'])||v[kind+'_path']!==`library/${folder}/${v[kind+'_sha256']}.${ext}`||v[kind+'_bytes']<=0||v[kind+'_bytes']>5242880)throw Error('Invalid immutable object');
    }
    return data;
  }
  return async req=>{
    if(req.method!=='POST')return json({error:'Method not allowed'},405);
    const token=req.headers.get('x-upload-capability')||'';
    if(token.length!==64||await sha(new TextEncoder().encode(token))!==config.capabilitySha256)return json({error:'Unauthorized'},401);
    if(now()>=config.expiresAt)return json({error:'Capability expired'},410);
    if(url!==`https://${config.projectRef}.supabase.co`||!['vlladyjynzmkswvnelku','nqrlhotrwyrphwumxtty'].includes(config.projectRef)||ids.size<1||ids.size>40||ids.size!==config.versionIds.length)return json({error:'Upload target or batch mismatch'},403);
    try {
      const body=await req.json();
      const versions=await approved();
      if(body.action==='versions')return json({versions});
      if(body.action==='bucket') {
        let result=await client.storage.getBucket('exercise-library');
        if(result.error) {
          if(!['404','400'].includes(String(result.error.status||result.error.statusCode))&&!/not found/i.test(result.error.message))throw Error('Bucket lookup failed');
          result=await client.storage.createBucket('exercise-library',{public:true,fileSizeLimit:5242880,allowedMimeTypes:['video/mp4','image/webp']});
          if(result.error)throw Error('Bucket creation failed');
          result=await client.storage.getBucket('exercise-library');
        }
        const b=result.data;
        if(result.error||!b?.public||Number(b.file_size_limit)!==5242880||b.allowed_mime_types?.length!==2||!['video/mp4','image/webp'].every(t=>b.allowed_mime_types.includes(t)))throw Error('Unexpected bucket configuration');
        return json({bucket:{id:b.id,public:true}});
      }
      const bucket=client.storage.from('exercise-library');
      if(body.action==='sign') {
        if(!versions.some(v=>v.video_path===body.path||v.poster_path===body.path))return json({error:'Object outside approved pilot'},403);
        const {data,error}=await bucket.createSignedUploadUrl(body.path,{upsert:false});
        if(error)throw Error('Signing failed');
        return json({path:body.path,token:data.token});
      }
      if(body.action==='verify') {
        const v=versions.find(v=>v.id===body.id);if(!v)return json({error:'Version outside approved pilot'},403);
        for(const kind of ['video','poster']) {
          const {data,error}=await bucket.download(v[kind+'_path']);
          const mime=kind==='video'?'video/mp4':'image/webp';
          if(error||!data||data.type.split(';')[0]!==mime)throw Error('Remote MIME verification failed');
          const bytes=await data.arrayBuffer();
          if(bytes.byteLength!==v[kind+'_bytes']||await sha(bytes)!==v[kind+'_sha256'])throw Error('Remote checksum verification failed');
        }
        const {data,error}=await client.from('media_asset_versions').update({files_verified_at:new Date(now()).toISOString()}).eq('id',v.id).eq('content_review_status','approved').eq('technical_status','passed').eq('approved_at',v.approved_at).eq('video_sha256',v.video_sha256).eq('poster_sha256',v.poster_sha256).select('id');
        if(error||data?.length!==1)throw Error('Approval changed before verification');
        return json({verified:v.id,published:false});
      }
      return json({error:'Unsupported operation'},400);
    } catch {return json({error:'Pilot operation failed; no publication performed'},409);}
  };
}
