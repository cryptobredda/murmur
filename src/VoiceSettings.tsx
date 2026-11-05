import { useEffect, useRef, useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { androidBridge } from "./native";
import type { Settings } from "./types";

export function VoiceSettings({settings,update,disabled,onBusy}:{settings:Settings;update:(patch:Partial<Settings>)=>Promise<boolean>;disabled:boolean;onBusy:(busy:boolean)=>void}){
  const native=androidBridge();
  const [cached,setCached]=useState(()=>{try{return JSON.parse(native?.nativeSpeechModels?.()||"[]").includes("piper-alba");}catch{return false;}});
  const [progress,setProgress]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const pending=useRef(""),disposed=useRef(false),busyCallback=useRef(onBusy);busyCallback.current=onBusy;
  useEffect(()=>{disposed.current=false;return()=>{disposed.current=true;if(pending.current)native?.cancelNativeSpeech?.(pending.current);busyCallback.current(false);};},[]);
  async function download(){
    if(!native?.prepareNativeSpeech||busy||disabled)return;
    setBusy(true);onBusy(true);setError("");setProgress("Connecting…");
    try{
      pending.current=native.prepareNativeSpeech("piper-alba",false);
      while(pending.current&&!disposed.current){
        const status=JSON.parse(native.nativeSpeechStatus?.(pending.current)||"{}");
        if(status.state==="error")throw new Error(status.error||"The voice could not download.");
        if(status.state==="done"){setCached(true);await update({voiceModel:"piper-alba"});break;}
        setProgress(status.total?`${(status.loaded/1e6).toFixed(1)} MB of ${(status.total/1e6).toFixed(1)} MB`:"Preparing voice…");
        await new Promise(resolve=>setTimeout(resolve,150));
      }
    }catch(error){if(!disposed.current)setError(error instanceof Error?error.message:"Could not download the voice.");}
    finally{pending.current="";if(!disposed.current){setBusy(false);onBusy(false);}}
  }
  function cancel(){if(pending.current)native?.cancelNativeSpeech?.(pending.current);pending.current="";}
  return <details className="voice-settings panel"><summary>Offline readback · optional</summary>
    <p className="section-description">Piper Alba · British English · 64 MB. Listen to a transcript from History. Readback is manual and runs on your phone.</p>
    <label className="trial-choice"><input type="checkbox" checked={settings.voiceModel==="piper-alba"} disabled={disabled||busy||!cached} onChange={event=>void update({voiceModel:event.target.checked?"piper-alba":"none"})}/>Enable readback in History</label>
    <div className="trial-actions">{busy?<><LoaderCircle size={18} className="spin"/><span>{progress}</span><button className="text-button" onClick={cancel}>Cancel download</button></>:!cached?<button className="button secondary" disabled={disabled||!native?.prepareNativeSpeech} onClick={()=>void download()}><Download size={16}/>Download voice</button>:<button className="text-button" disabled={disabled} onClick={()=>{if(native?.removeNativeSpeech?.("piper-alba")){setCached(false);void update({voiceModel:"none"});}else setError("Stop readback before removing the voice.");}}>Remove downloaded voice</button>}</div>
    {error&&<p className="field-error" role="alert">{error}</p>}
    <p className="hint">Small voice models are more suitable for older phones than the 600M speech recognizers. Start with 4 GB RAM; this is a recommendation, not a certified minimum. This voice reads English and is separate from speech recognition.</p>
  </details>;
}
