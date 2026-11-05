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
    const demo=window.modelUiFixture={cache:JSON.parse(localStorage.getItem('fixture-cache')||'["parakeet-v3"]'),jobs:{},sequence:0,exports:[],awake:[],cancelled:[],stall:false,stallDownload:false,failModel:''};
    const job=spec=>{const id='fixture-'+(++demo.sequence);demo.jobs[id]={...spec,count:0};return id;};
    const info={id:'fixture-audio',createdAt:1700000000000,updatedAt:1700000000000,sampleRate:16000,bytes:352000,status:'complete',text:'Original saved transcript.',raw:'Original saved transcript.',model:'Parakeet TDT v3',source:'local'};
    const status=id=>{const spec=demo.jobs[id];if(!spec)return JSON.stringify({state:'error',error:'Missing fixture job'});if(spec.cancelled)return JSON.stringify({state:'cancelled',error:''});
      if(spec.kind==='download'&&demo.failModel===spec.model)return JSON.stringify({state:'error',error:'Fixture model download failed.'});
      spec.count++;if((spec.kind==='trial'&&demo.stall)||(spec.kind==='download'&&demo.stallDownload)||spec.count<(spec.kind==='tts'?20:3))return JSON.stringify({state:'running',loaded:32e6,total:64e6});
      if(spec.kind==='download'&&!demo.cache.includes(spec.model)){demo.cache.push(spec.model);localStorage.setItem('fixture-cache',JSON.stringify(demo.cache));}
      return JSON.stringify({state:'done',text:spec.model==='nemotron-multilingual'?'one two four':'one two three'});};
    window.MurmurAndroid={
      getLaunchContext:()=>JSON.stringify({version:'UI fixture'}),deviceInfo:()=>JSON.stringify({model:'Fictional UI fixture',androidVersion:'16',sdk:36,ramBytes:12*2**30,freeStorageBytes:32e9,arm64:true,soc:'Fictional CPU'}),
      readSecret:()=>'',writeSecret:()=>true,configureSpeech:(provider,model)=>{demo.model=model;},configureSpeechLanguage:language=>{demo.language=language;},configureRecognition:(mode,hints)=>{demo.recognitionMode=mode;demo.hints=JSON.parse(hints);},
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
      const db=request.result,tx=db.transaction(['settings','history','words'],'readwrite');
      tx.objectStore('settings').put({id:'preferences',value:{provider:'local',localModel:'parakeet-v3',language:'en',editingProvider:'basic',onboardingComplete:true}});
      tx.objectStore('history').put({id:'fixture-audio',audioId:'fixture-audio',text:'Original saved transcript.',raw:'Original saved transcript.',duration:11,createdAt:1700000000000,source:'local',model:'Parakeet TDT v3',style:'natural',status:'complete',starred:false});
      tx.objectStore('words').put({id:'fixture-word',spoken:'less ter',replacement:'Leicester'});
      tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);
    };
  }));
  await page.reload();await page.getByRole('button',{name:'Start dictating',exact:true}).waitFor();
  await page.getByRole('button',{name:'Models',exact:true}).first().click();
  assert.equal(await page.locator('.model-card').count(),4);
  assert.ok(await page.locator('#model-parakeet-v3').isChecked(),'An existing tester retains the current model.');
  const original=page.locator('.model-card').filter({has:page.locator('#model-parakeet-v3')});
  await original.getByRole('button',{name:'Ready',exact:true}).waitFor();
  const ultra=page.locator('.model-card').filter({has:page.locator('#model-parakeet-ultra')});
  await page.evaluate(()=>{window.modelUiFixture.stallDownload=true;});
  await ultra.getByRole('button',{name:'Download and use',exact:true}).click();
  await ultra.getByRole('button',{name:'Cancel download',exact:true}).waitFor();
  assert.ok(await page.locator('#model-parakeet-v3').isChecked(),'Selection stays on the usable model while Ultra downloads.');
  await ultra.getByRole('button',{name:'Cancel download',exact:true}).click();
  await ultra.getByRole('button',{name:'Download and use',exact:true}).waitFor();
  assert.ok(await page.locator('#model-parakeet-v3').isChecked(),'Cancelling Ultra keeps the old selection.');
  await page.evaluate(()=>{window.modelUiFixture.stallDownload=false;window.modelUiFixture.failModel='parakeet-ultra';});
  await ultra.getByRole('button',{name:'Download and use',exact:true}).click();
  await page.getByText('Fixture model download failed.',{exact:true}).first().waitFor();
  assert.ok(await page.locator('#model-parakeet-v3').isChecked(),'A failed download keeps the old selection.');
  await page.evaluate(()=>{
    window.modelUiFixture.failModel='';
    window.modelUiFixture.realPut=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(value,...args){
      if(this.name==='settings'&&value?.id==='preferences'&&value.value?.localModel==='parakeet-ultra')throw new DOMException('Fixture storage full.','QuotaExceededError');
      return window.modelUiFixture.realPut.call(this,value,...args);
    };
  });
  await ultra.getByRole('button',{name:'Download and use',exact:true}).click();
  await page.getByText('The model is downloaded, but its selection could not be saved. Your previous model is still selected.',{exact:true}).first().waitFor();
  assert.ok(await page.locator('#model-parakeet-v3').isChecked(),'A failed settings write rolls back the selection.');
  await page.evaluate(()=>{IDBObjectStore.prototype.put=window.modelUiFixture.realPut;});
  await page.reload();await page.getByRole('button',{name:'Models',exact:true}).first().click();
  await original.getByRole('button',{name:'Ready',exact:true}).waitFor();
  assert.ok(await page.locator('#model-parakeet-v3').isChecked(),'The previous selection also survives a restart after storage failure.');
  await ultra.getByRole('button',{name:'Use model',exact:true}).click();
  await ultra.getByRole('button',{name:'Ready',exact:true}).waitFor();
  assert.ok(await page.locator('#model-parakeet-ultra').isChecked());
  assert.ok(await page.evaluate(()=>window.modelUiFixture.cache.includes('parakeet-v3')),'Ultra does not delete the previous download.');
  await page.reload();await page.getByRole('button',{name:'Models',exact:true}).first().click();
  assert.ok(await page.locator('#model-parakeet-ultra').isChecked(),'Ultra selection survives restarting.');
  await ultra.getByRole('button',{name:'Ready',exact:true}).waitFor();
  await page.locator('#model-parakeet-v3').click();await original.getByRole('button',{name:'Ready',exact:true}).waitFor();
  assert.ok(await page.locator('#model-parakeet-v3').isChecked());
  await page.locator('#model-parakeet-ultra').click();await ultra.getByRole('button',{name:'Ready',exact:true}).waitFor();
  assert.ok(await page.locator('#model-parakeet-ultra').isChecked());
  const multilingual=page.locator('.model-card').filter({has:page.locator('#model-nemotron-multilingual')});
  await multilingual.getByRole('button',{name:'Download and use',exact:true}).click();
  await multilingual.getByRole('button',{name:'Ready',exact:true}).waitFor();
  await page.reload();await page.getByRole('button',{name:'Models',exact:true}).first().click();
  assert.ok(await page.locator('#model-nemotron-multilingual').isChecked(),'Selection survives restarting.');
  await multilingual.getByRole('button',{name:'Ready',exact:true}).waitFor();
  const comparison=page.locator('.model-trials');await comparison.locator('summary').first().click();
  await comparison.getByRole('textbox').fill('one two three');await comparison.getByRole('button',{name:'Run comparison'}).click();
  await comparison.getByRole('button',{name:'Export results'}).waitFor();
  assert.equal(await comparison.locator('tbody tr').count(),3);assert.ok((await comparison.innerText()).includes('33.3%'));
  await comparison.getByRole('button',{name:'Export results'}).click();
  const exported=await page.evaluate(()=>window.modelUiFixture.exports[0].body);
  assert.equal(exported.results.length,3);assert.equal(exported.writingApplied,false);assert.equal(exported.source.audioSeconds,11);
  assert.equal(exported.results.at(-1).wer.edits,1);assert.equal(exported.device.model,'Fictional UI fixture');
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
  await page.getByRole('button',{name:'Settings',exact:true}).first().click();
  assert.equal(await page.getByLabel('Recognition accuracy',{exact:true}).inputValue(),'accurate');
  assert.equal(await page.getByLabel('English spelling',{exact:true}).inputValue(),'en-GB');
  await page.waitForFunction(()=>window.modelUiFixture.hints?.includes('Leicester'));
  await page.getByLabel('Recognition accuracy',{exact:true}).selectOption('fast');
  await page.getByLabel('English spelling',{exact:true}).selectOption('en-US');
  await page.waitForFunction(()=>window.modelUiFixture.recognitionMode==='fast');
  await page.reload();await page.getByRole('button',{name:'Settings',exact:true}).first().click();
  assert.equal(await page.getByLabel('Recognition accuracy',{exact:true}).inputValue(),'fast');
  assert.equal(await page.getByLabel('English spelling',{exact:true}).inputValue(),'en-US');
  await page.getByLabel('Recognition accuracy',{exact:true}).selectOption('accurate');
  await page.getByLabel('English spelling',{exact:true}).selectOption('en-GB');
  assert.ok(await page.getByRole('link',{name:'info@zyralabs.xyz',exact:true}).count());
  assert.deepEqual(errors,[]);console.log('Model UI checks passed: Ultra upgrade, cancelled/failed downloads preserve the selected model, persisted selection/settings and history, dictionary hints, comparison/export, cancel/wake release, optional voice and readback. Fictional bridge data; no phone benchmarks.');
}finally{await browser?.close();preview.kill('SIGTERM');}
