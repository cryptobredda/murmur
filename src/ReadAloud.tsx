import { useEffect, useRef, useState } from "react";
import { Volume2, X } from "lucide-react";
import { androidBridge } from "./native";

export function ReadAloud({text,disabled}:{text:string;disabled:boolean}){
  const native=androidBridge(),job=useRef("");
  const [playing,setPlaying]=useState(false),[error,setError]=useState("");
  function stop(){if(job.current)native?.cancelNativeTts?.(job.current);job.current="";setPlaying(false);}
  useEffect(()=>{const hide=()=>stop();window.addEventListener("murmur-native-background",hide);return()=>{if(job.current)native?.cancelNativeTts?.(job.current);job.current="";window.removeEventListener("murmur-native-background",hide);};},[]);
  async function speak(){
    if(!native?.speakNativeText||disabled)return;setError("");setPlaying(true);
    const current=native.speakNativeText(text);job.current=current;
    try{
      while(job.current===current){const status=JSON.parse(native.nativeTtsStatus?.(current)||"{}");if(status.state==="error")throw new Error(status.error||"Readback could not start.");if(status.state==="done"||status.state==="cancelled")break;await new Promise(resolve=>setTimeout(resolve,150));}
    }catch(error){if(job.current===current)setError(error instanceof Error?error.message:"Readback could not start.");}
    finally{if(job.current===current){job.current="";setPlaying(false);}}
  }
  return <div className="readback-control"><button className="text-button" disabled={!playing&&(disabled||!text||!native?.speakNativeText)} onClick={()=>playing?stop():void speak()}>{playing?<X size={15}/>:<Volume2 size={15}/>} {playing?"Stop readback":"Read aloud"}</button>{error&&<span className="field-error" role="alert">{error}</span>}</div>;
}
