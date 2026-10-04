import { useEffect, useRef, useState } from "react";
import { Download, LoaderCircle, X } from "lucide-react";
import { androidBridge, androidDevice, androidLaunch } from "./native";
import { models, speechModelOptions, supportsSpeechLanguage, type LocalModel, type Transcript } from "./types";
import { wordErrorRate } from "./model-trials.mjs";

interface Result { model: LocalModel; elapsedMs: number; audioSeconds: number; text: string; error?: string; wer: ReturnType<typeof wordErrorRate>; }
export function ModelTrials({ history, cached, language, disabled, onBusy }: {
  history: Transcript[]; cached: LocalModel[]; language: string; disabled: boolean; onBusy: (busy: boolean) => void;
}) {
  const native = androidBridge();
  const clips = history.filter(item => item.audioId && item.status !== "recording" && item.status !== "processing");
  const [clipId, setClipId] = useState(""), [reference, setReference] = useState("");
  const [selected, setSelected] = useState<LocalModel[]>(speechModelOptions());
  const [results, setResults] = useState<Result[]>([]), [running, setRunning] = useState(false), [current, setCurrent] = useState("");
  const [error, setError] = useState(""), [report, setReport] = useState<object | null>(null);
  const abort = useRef<AbortController | null>(null), job = useRef("");
  const busyCallback = useRef(onBusy);busyCallback.current=onBusy;
  function cancel() { abort.current?.abort(); if(job.current)native?.cancelNativeSpeech?.(job.current); }
  useEffect(() => {
    const hidden = () => { if(document.visibilityState === "hidden")cancel(); };
    const background = () => cancel();
    document.addEventListener("visibilitychange", hidden);window.addEventListener("murmur-native-background",background);
    return () => {cancel();native?.keepModelTrialAwake?.(false);busyCallback.current(false);document.removeEventListener("visibilitychange", hidden);window.removeEventListener("murmur-native-background",background);};
  }, []);
  async function run() {
    const clip=clips.find(item=>item.audioId===(clipId || clips[0]?.audioId));
    if(!clip?.audioId || !native?.startNativeModelTrial || running || disabled)return;
    const candidates=selected.filter(model=>cached.includes(model)&&supportsSpeechLanguage(model,language));
    if(!candidates.length){setError("Download and select a model that supports your language first.");return;}
    const controller=new AbortController();abort.current=controller;setRunning(true);onBusy(true);setError("");setResults([]);setReport(null);
    native.keepModelTrialAwake?.(true);
    const trialResults:Result[]=[];
    const exactReference=reference.trim();
    try{
      const info=JSON.parse(native.nativeAudioInfo?.(clip.audioId)||"{}");
      const seconds=Number(info.bytes)/(2*Number(info.sampleRate||16000))||clip.duration;
      if(!seconds || seconds<=0)throw new Error("This saved recording is unavailable.");
      for(const model of candidates){
        if(controller.signal.aborted)break;
        setCurrent(models[model].name);const start=performance.now();
        const result:Result={model,elapsedMs:0,audioSeconds:seconds,text:"",wer:null};
        try{
          job.current=native.startNativeModelTrial(clip.audioId,model,language);
          while(!controller.signal.aborted){
            const status=JSON.parse(native.nativeSpeechStatus?.(job.current)||'{}');
            if(status.state==="error")throw new Error(status.error||"Transcription failed; the audio is saved.");
            if(status.state==="done"){result.text=status.text||"";result.wer=wordErrorRate(exactReference,result.text);break;}
            await new Promise(resolve=>setTimeout(resolve,100));
          }
        }catch(error){result.error=error instanceof Error?error.message:"Could not run this model.";}
        finally{if(controller.signal.aborted)native.cancelNativeSpeech?.(job.current);job.current="";}
        result.elapsedMs=performance.now()-start;
        if(controller.signal.aborted)break;
        trialResults.push(result);setResults([...trialResults]);
      }
      setReport({schemaVersion:1,createdAt:new Date().toISOString(),appVersion:androidLaunch().version,device:androidDevice(),language,
        source:{audioId:clip.audioId,audioSeconds:seconds},reference:exactReference||null,coldModelLoadIncluded:true,writingApplied:false,cancelled:controller.signal.aborted,results:trialResults});
    }catch(error){setError(error instanceof Error?error.message:"Could not read saved audio.");}
    finally{native.keepModelTrialAwake?.(false);abort.current=null;setCurrent("");setRunning(false);onBusy(false);}
  }
  return <details className="model-trials panel">
    <summary>Compare models with a saved recording</summary>
    <p className="section-description">Run downloaded models on the same audio, without rewriting. Your original history and recording stay saved. Each run includes loading the model.</p>
    {!native?.startNativeModelTrial && <p>Install the latest Android APK to run this comparison.</p>}
    <label className="field">Recording<select value={clipId || clips[0]?.audioId || ""} disabled={running || disabled} onChange={event=>setClipId(event.target.value)}>
      {!clips.length&&<option value="">Make a dictation first</option>}
      {clips.map(clip=><option key={clip.id} value={clip.audioId}>{new Date(clip.createdAt).toLocaleString()} · {Math.round(clip.duration)}s · {(clip.text || "Saved audio").slice(0,45)}</option>)}
    </select></label>
    <div className="trial-models">{speechModelOptions().map(model=><label key={model}>
      <input type="checkbox" checked={selected.includes(model)} disabled={running||disabled||!cached.includes(model)||!supportsSpeechLanguage(model,language)}
        onChange={event=>setSelected(previous=>event.target.checked?[...previous,model]:previous.filter(item=>item!==model))}/>
      {models[model].name}{!cached.includes(model)?" · download first":!supportsSpeechLanguage(model,language)?" · language unsupported":""}
    </label>)}</div>
    <label className="field">Exact reference transcript (optional)<textarea value={reference} disabled={running||disabled} onChange={event=>setReference(event.target.value)} maxLength={20000} rows={3} placeholder="Enter what you actually said to measure word errors."/></label>
    <p className="hint">Speed below includes loading and processing the entire saved clip. Normal streaming dictation processes speech while you talk. Word error rate ignores punctuation and case; it is most useful for languages written with spaces.</p>
    <div className="trial-actions">{running?<><LoaderCircle size={18} className="spin"/><span>{current}</span><button className="text-button" onClick={cancel}><X size={16}/>Cancel</button></>:<button className="button secondary" disabled={disabled||!clips.length||!native?.startNativeModelTrial} onClick={()=>void run()}>Run comparison</button>}
      {report&&!running&&<button className="text-button" onClick={()=>native?.exportText("murmur-model-comparison.json",JSON.stringify(report,null,2),"application/json")}><Download size={16}/>Export results</button>}
    </div>
    {error&&<p className="field-error" role="alert">{error}</p>}
    {!!results.length&&<div className="trial-results"><table><thead><tr><th>Model</th><th>Time</th><th>Time / audio</th><th>Word errors</th></tr></thead><tbody>
      {results.map(result=><tr key={result.model}><td>{models[result.model].name}</td><td>{(result.elapsedMs/1000).toFixed(1)}s</td><td>{(result.elapsedMs/1000/result.audioSeconds).toFixed(2)}×</td><td>{result.error?"Failed":result.wer?`${(result.wer.rate*100).toFixed(1)}%`:"No reference"}</td></tr>)}
    </tbody></table>{results.map(result=><details key={result.model}><summary>{models[result.model].name} transcript</summary><p className={result.error?"field-error":""}>{result.error||result.text}</p></details>)}</div>}
  </details>;
}
