import assert from 'node:assert/strict'
import { attachMedia, attachWorkoutMedia, mediaEnabled, validMedia } from '../../src/lib/mediaPolicy.js'

const config={enabled:true,sections:['strength:Legs']}
const leg={id:'leg-1',name:'Shared name',category:'strength',muscle_group:'Legs',coach_id:null,is_custom:false}
const arm={...leg,id:'arm-1',muscle_group:'Arms'}
const prehab={...leg,id:'prehab-1',category:'prehab'}
const media={exercise_id:'leg-1',media_asset_id:'asset-1',version_id:'version-1',storage_bucket:'exercise-library',
  video_path:'library/animations/'+'a'.repeat(64)+'.mp4',poster_path:'library/posters/'+'b'.repeat(64)+'.webp',
  width:576,height:540,duration_ms:3600}
let calls=[]
const client={from(table){assert.equal(table,'exercise_media');return{select(){return{async in(field,ids){assert.equal(field,'exercise_id');calls.push(ids);return{data:ids.map(id=>({...media,exercise_id:id})),error:null}}}}}}}
assert.equal(mediaEnabled(leg,config),true)
for(const e of [arm,prehab,{...leg,id:null},{...leg,is_custom:true},{...leg,coach_id:'other-coach'}])assert.equal(mediaEnabled(e,config),false)
assert.equal(mediaEnabled(leg,{...config,enabled:false}),false)
assert.equal(validMedia(media),true)
for(const broken of [{...media,video_path:'https://wrong.example/video.mp4'},{...media,poster_path:'../file.webp'},
  {...media,storage_bucket:'private'},{...media,width:0},{...media,duration_ms:null}])assert.equal(validMedia(broken),false)
await attachMedia(client,[leg,arm,prehab],{...config,enabled:false});assert.equal(calls.length,0)
const result=await attachMedia(client,[leg,arm,prehab],config);assert.equal(calls.length,1);assert.deepEqual(calls[0],['leg-1'])
assert.equal(result[0].media.version_id,'version-1');assert.equal(result[1].media,null)
calls=[]
await attachWorkoutMedia(client,[{id:'w1',exercises:leg},{id:'w2',exercises:leg}],[{id:'p1',exercises:prehab}],config)
assert.deepEqual(calls,[['leg-1']])
const failure={from(){return{select(){return{in:async()=>({data:null,error:{message:'unavailable'}})}}}}}
const fallback=await attachMedia(failure,[leg,arm],config);assert.equal(fallback.length,2);assert.equal(fallback[0].name,leg.name);assert.equal(fallback[0].media,null)
const sameName=await attachMedia(client,[leg,{...arm,name:leg.name}],config);assert.equal(sameName[1].media,null)
console.log('PASS player policy: opt-in section flags, strict file paths, batch metadata, duplicate IDs, custom/name isolation and text fallback')
