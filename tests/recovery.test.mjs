import test from 'node:test';
import assert from 'node:assert/strict';
import {retrySavedAudio} from '../src/recovery.mjs';
test('retries reuse the same captured audio and report attempts',async()=>{
 const audio=new Float32Array([.1,.2,.3]),seen=[],attempts=[];
 const text=await retrySavedAudio(async()=>{seen.push(audio);if(seen.length<3)throw Error('Model crashed');return 'Recovered words';},{onAttempt:async n=>{attempts.push(n);},delayMs:0});
 assert.equal(text,'Recovered words');assert.deepEqual(attempts,[1,2,3]);assert.ok(seen.every(value=>value===audio));
});
test('a stalled attempt times out and can retry the retained recording',async()=>{
 let calls=0;
 assert.equal(await retrySavedAudio(async()=>++calls===1?new Promise(()=>{}):'Recovered',{timeouts:[10,30],delayMs:0}),'Recovered');
 assert.equal(calls,2);
});
test('user cancellation stops retries and permanent provider errors keep the recording',async()=>{
 const controller=new AbortController();let calls=0;
 await assert.rejects(retrySavedAudio(async signal=>{calls++;controller.abort();await new Promise(resolve=>setTimeout(resolve,5));return 'late';},{signal:controller.signal,delayMs:0}),{name:'AbortError'});
 assert.equal(calls,1);
 calls=0;
 await assert.rejects(retrySavedAudio(async()=>{calls++;throw Error('The provider rejected your API key.');},{delayMs:0}),/API key/);
 assert.equal(calls,1);
});
