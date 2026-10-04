import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

// UI contract checks use fictional bridge data, never real recordings or model timings.
const reserve=createServer();await new Promise(resolve=>reserve.listen(0,'127.0.0.1',resolve));const port=reserve.address().port;
await new Promise(resolve=>reserve.close(resolve));const origin=`http://127.0.0.1:${port}`;
const preview=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore'});
let browser;
try{
  let ready=false;for(let attempt=0;attempt<100;attempt++){try{ready=(await fetch(origin)).ok;}catch{}if(ready)break;await delay(100);}
  assert.ok(ready,'Build production assets before the UI check.');
  browser=await chromium.launch({...process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{},args:['--disable-dev-shm-usage']});
  const context=await browser.newContext({viewport:{width:430,height:932},deviceScaleFactor:1});
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  await context.addInitScript(()=>{
    const demo=window.modelUiFixture={cache:JSON.parse(localStorage.getItem('fixture-cache')||'["parakeet-v3"]'),jobs:{},sequence:0,exports:[],awake:[],cancelled:[],stall:false};
    const job=spec=>{const id='fixture-'+(++demo.sequence);demo.jobs[id]={...spec,count:0};return id;};
    const info={id:'fixture-audio',createdAt:1700000000000,updatedAt:1700000000000,sampleRate:16000,bytes:352000,status:'complete',text:'Original saved transcript.',raw:'Original saved transcript.',model:'Parakeet TDT v3',source:'local'};
    const status=id=>{const spec=demo.jobs[id];if(!spec)return JSON.stringify({state:'error',error:'Missing fixture job'});if(spec.cancelled)return JSON.stringify({state:'cancelled',error:''});
      spec.count++;if((spec.kind==='trial'&&demo.stall)||spec.count<(spec.kind==='tts'?20:3))return JSON.stringify({state:'running',loaded:32e6,total:64e6});
      if(spec.kind==='download'&&!demo.cache.includes(spec.model)){demo.cache.push(spec.model);localStorage.setItem('fixture-cache',JSON.stringify(demo.cache));}
      return JSON.stringify({state:'done',text:spec.model==='nemotron-multilingual'?'one two four':'one two three'});};
    window.MurmurAndroid={
      getLaunchContext:()=>JSON.stringify({version:'UI fixture'}),deviceInfo:()=>JSON.stringify({model:'Fictional UI fixture',androidVersion:'16',sdk:36,ramBytes:12*2**30,freeStorageBytes:32e9,arm64:true,soc:'Fictional CPU'}),
      readSecret:()=>'',writeSecret:()=>true,configureSpeech:(provider,model)=>{demo.model=model;},configureSpeechLanguage:language=>{demo.language=language;},
      configureOverlay:()=>{},configureOverlayAppearance:()=>{},accessibilityEnabled:()=>true,overlayStatus:()=>JSON.stringify({pausedUntil:0}),backgroundBusy:()=>false,
      nativeSpeechModels:()=>JSON.stringify(demo.cache),prepareNativeSpeech:model=>job({kind:'download',model}),nativeSpeechStatus:status,
      cancelNativeSpeech:id=>{demo.cancelled.push(id);demo.jobs[id].cancelled=true;},startNativeModelTrial:(audioId,model,language)=>job({kind:'trial',audioId,model,language}),
      keepModelTrialAwake:value=>demo.awake.push(value),listNativeAudio:()=>JSON.stringify([info]),nativeAudioInfo:()=>JSON.stringify(info),nativeAudioUrl:()=>'',
      exportText:(name,text)=>{demo.exports.push({name,body:JSON.parse(text)});return true;},speakNativeText:()=>job({kind:'tts'}),nativeTtsStatus:status,
      cancelNativeTts:id=>{demo.cancelled.push(id);demo.jobs[id].cancelled=true;},removeNativeSpeech:model=>{demo.cache=demo.cache.filter(item=>item!==model);return true;},
    };
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin);await page.getByRole('heading',{name:'Your voice. Ready to go.'}).waitFor();
  await page.evaluate(()=>new Promise((resolve,reject)=>{
    const request=indexedDB.open('murmur-local');request.onerror=()=>reject(request.error);request.onsuccess=()=>{
      const db=request.result,tx=db.transaction(['settings','history'],'readwrite');
      tx.objectStore('settings').put({id:'preferences',value:{provider:'local',localModel:'parakeet-v3',language:'en',editingProvider:'basic',onboardingComplete:true}});
      tx.objectStore('history').put({id:'fixture-audio',audioId:'fixture-audio',text:'Original saved transcript.',raw:'Original saved transcript.',duration:11,createdAt:1700000000000,source:'local',model:'Parakeet TDT v3',style:'natural',status:'complete',starred:false});
      tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);
    };
  }));
  await page.reload();await page.getByRole('button',{name:'Start dictating',exact:true}).waitFor();
  await page.getByRole('button',{name:'Models',exact:true}).first().click();
  assert.equal(await page.locator('.model-card').count(),3);
  const multilingual=page.locator('.model-card').filter({has:page.locator('#model-nemotron-multilingual')});
  await page.locator('#model-nemotron-multilingual').check();await multilingual.getByRole('button',{name:'Download',exact:true}).click();
  await multilingual.getByRole('button',{name:'Ready',exact:true}).waitFor();
  await page.reload();await page.getByRole('button',{name:'Models',exact:true}).first().click();
  assert.ok(await page.locator('#model-nemotron-multilingual').isChecked(),'Selection survives restarting.');
  await multilingual.getByRole('button',{name:'Ready',exact:true}).waitFor();
  const comparison=page.locator('.model-trials');await comparison.locator('summary').first().click();
  await comparison.getByRole('textbox').fill('one two three');await comparison.getByRole('button',{name:'Run comparison'}).click();
  await comparison.getByRole('button',{name:'Export results'}).waitFor();
  assert.equal(await comparison.locator('tbody tr').count(),2);assert.ok((await comparison.innerText()).includes('33.3%'));
  await comparison.getByRole('button',{name:'Export results'}).click();
  const exported=await page.evaluate(()=>window.modelUiFixture.exports[0].body);
  assert.equal(exported.results.length,2);assert.equal(exported.writingApplied,false);assert.equal(exported.source.audioSeconds,11);
  assert.equal(exported.results[1].wer.edits,1);assert.equal(exported.device.model,'Fictional UI fixture');
  await page.evaluate(()=>{window.modelUiFixture.stall=true;});await comparison.getByRole('button',{name:'Run comparison'}).click();
  await comparison.getByRole('button',{name:'Cancel',exact:true}).click();await comparison.getByRole('button',{name:'Run comparison'}).waitFor();
  assert.ok(await page.evaluate(()=>window.modelUiFixture.cancelled.length>0));
  assert.equal(await page.evaluate(()=>window.modelUiFixture.awake.at(-1)),false);
  const voice=page.locator('.voice-settings');await voice.locator('summary').click();await voice.getByRole('button',{name:'Download voice'}).click();
  await voice.getByRole('button',{name:'Remove downloaded voice'}).waitFor();assert.ok(await voice.getByRole('checkbox').isChecked());
  await page.getByRole('button',{name:'History',exact:true}).first().click();await page.getByRole('button',{name:'Read aloud',exact:true}).click();
  await page.getByRole('button',{name:'Stop readback',exact:true}).click();await page.getByRole('button',{name:'Read aloud',exact:true}).waitFor();
  const saved=await page.evaluate(()=>new Promise(resolve=>{const request=indexedDB.open('murmur-local');request.onsuccess=()=>{const db=request.result,read=db.transaction('history').objectStore('history').get('fixture-audio');read.onsuccess=()=>{resolve(read.result);db.close();};};}));
  assert.equal(saved.text,'Original saved transcript.');assert.equal(saved.audioId,'fixture-audio');assert.equal(saved.status,'complete');
  assert.deepEqual(errors,[]);console.log('Model UI checks passed: download, persisted selection, comparison/export, cancel/wake release, optional voice and readback. Fictional bridge data; no phone benchmarks.');
}finally{await browser?.close();preview.kill('SIGTERM');}
