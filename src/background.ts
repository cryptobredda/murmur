import * as db from './db';
import {normalizeSettings,models,editingModels,type Settings,type Transcript} from './types';
import {loadModel,cancelLocal,localTranscribe,cloudTranscribe,isModelCached} from './engine';
import {loadEditingModel,editWriting,cancelEditing,isEditingModelCached,automaticEditingBudget} from './writing';
import {formatText,chooseProfile,codeFormat,validEditedText} from './core.mjs';
import {retrySavedAudio} from './recovery.mjs';
interface Run {id:string;packageName:string;}
let warming:Promise<void>|null=null;
let generation=0,speechReady='',editingReady='',currentAbort:AbortController|null=null;
const native=window.MurmurAndroid!;
async function prepareSpeech(settings:Settings) {
 if(settings.provider!=='local'||speechReady===settings.localModel)return;
 if(!await isModelCached(settings.localModel))throw new Error('Download your speech model in Murmur first.');
 await loadModel(settings.localModel,()=>{},true);speechReady=settings.localModel;
}
async function prepareEditing(settings:Settings) {
 if(settings.editingProvider!=='local'||editingReady===settings.editingModel)return;
 if(!await isEditingModelCached(settings.editingModel))throw new Error('Editing model is unavailable.');
 await loadEditingModel(settings.editingModel,()=>{},true);editingReady=settings.editingModel;
}
async function run(request:Run) {
 if(native.isBackgroundRequestCurrent?.(request.id)!==true)return;
 const token=++generation,abort=new AbortController();currentAbort=abort;
 const alive=()=>token===generation&&native.isBackgroundRequestCurrent?.(request.id)===true;
 let pending:Transcript|undefined;const started=performance.now();
 const timer=setTimeout(()=>{abort.abort();cancelLocal();cancelEditing();speechReady='';editingReady='';},165000);
 try {
  const data=await db.load(),settings=normalizeSettings(data.settings);
  if(!alive())return;
  if(!settings.onboardingComplete)throw new Error('Finish setup in Murmur first.');
  const info=db.nativeAudioInfo(request.id), prior=data.history.find(record=>record.id===request.id);
  const duration=Number(info.bytes)/(Number(info.sampleRate || 16000)*2);
  pending={...prior,id:request.id,audioId:request.id,text:prior?.text || '',raw:prior?.raw || '',createdAt:prior?.createdAt || Number(info.createdAt) || Date.now(),updatedAt:Date.now(),duration,
    source:settings.provider,model:settings.provider==='local'?models[settings.localModel].name:settings.cloudModel,style:settings.style,starred:prior?.starred || false,status:'processing',error:'',targetApp:request.packageName,mode:'dictate'};
  await db.saveTranscript(pending);
  if(!alive())return;
  const nativeAsr=settings.provider==='local'&&models[settings.localModel].engine==='native';
  const audio=nativeAsr?new Float32Array(0):await db.readAudio(request.id);
  let energy=0;for(const value of audio)energy+=value*value;
  if(nativeAsr?duration<=0:!audio.length||Math.sqrt(energy/audio.length)<.0015)throw new Error('No speech heard. The recording is saved in History.');
  if(warming)await warming;
  if(!alive())return;
  await prepareSpeech(settings);
  if(!alive())return;
  const key=await db.readSecret('speech',db.credentialScope(settings.provider,settings.cloudEndpoint));
  const raw=await retrySavedAudio((signal:AbortSignal,attempt:number)=>settings.provider==='local'
    ?localTranscribe(audio,settings.language,request.id,attempt>1,signal):cloudTranscribe(audio,settings,key,signal),{
    signal:abort.signal,
    onAttempt:async(attempt:number)=>{if(alive()){pending={...pending!,attempts:attempt,updatedAt:Date.now()};await db.saveTranscript(pending);}},
    reset:async()=>{if(alive()&&settings.provider==='local'){cancelLocal();speechReady='';await prepareSpeech(settings);}},
  });
  if(!alive())return;
  const profile=chooseProfile(settings.profiles,request.packageName);
  let text=formatText(profile?.format==='code'?codeFormat(raw):raw,{...settings,tone:profile?.tone||settings.tone,codeMode:profile?.format==='code'},data.words,data.snippets);
  const requestedEditingModel=settings.editingProvider==='local'?editingModels[settings.editingModel].name:settings.editingProvider==='basic'?'Smart cleanup':settings.editingCloudModel;
  let appliedEditingModel=settings.style==='verbatim'?'Verbatim':'Smart cleanup';
  if(settings.editingProvider!=='basic'&&settings.style!=='verbatim') {
   const editAbort=new AbortController();const cancelEdit=()=>editAbort.abort();abort.signal.addEventListener('abort',cancelEdit,{once:true});
   const editTimer=setTimeout(()=>{editAbort.abort();if(settings.editingProvider==='local'){cancelEditing();editingReady='';}},automaticEditingBudget(settings));
   try {
    await prepareEditing(settings);
    const edited=await editWriting(text,settings,await db.readSecret('editing',db.credentialScope(settings.editingProvider,settings.editingEndpoint)),profile,editAbort.signal);
    if(validEditedText(text,edited,[...data.words.map(w=>w.replacement),...data.snippets.map(s=>s.text)])){text=edited;appliedEditingModel=requestedEditingModel;}
   } catch { /* Normal automatic cleanup silently keeps the transcription. */ }
   finally{clearTimeout(editTimer);abort.signal.removeEventListener('abort',cancelEdit);}
  }
  if(!alive())return;
  if(!text.trim())throw new Error('No words recognized. Tap to retry.');
  const now=Date.now(),record:Transcript={...pending!,id:request.id,text,raw,status:'complete',error:'',processingMs:Math.round(performance.now()-started),createdAt:pending!.createdAt,updatedAt:now,duration,source:settings.provider,model:settings.provider==='local'?models[settings.localModel].name:settings.cloudModel,style:settings.style,starred:false,targetApp:request.packageName,mode:'dictate',editingModel:appliedEditingModel,requestedEditingModel};
  await db.saveTranscript(record);
  if(!alive())return;
  native.backgroundResult?.(request.id,text,settings.autoCopy,'');
 }catch(error){if(alive()){const message=error instanceof Error?error.message:'Dictation failed. Your recording is saved.';if(pending)await db.saveTranscript({...pending,status:'failed',error:message,updatedAt:Date.now()}).catch(()=>{});native.backgroundResult?.(request.id,'',false,message);}}
 finally {clearTimeout(timer);if(token===generation)currentAbort=null;}
}
function cancel() {generation++;currentAbort?.abort();currentAbort=null;cancelLocal();cancelEditing();speechReady='';editingReady='';}
// Prewarm only explicitly downloaded speech; downloads never start from the overlay.
async function warmTask() {try{const data=await db.load(),settings=normalizeSettings(data.settings);if(settings.onboardingComplete&&settings.provider==='local'&&await isModelCached(settings.localModel))await prepareSpeech(settings);}catch{}}
function warm(){if(!warming)warming=warmTask().finally(()=>{warming=null;});}
Object.assign(window,{MurmurBackground:{run,cancel,warm}});
native.backgroundReady?.();
