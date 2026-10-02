import {useEffect,useState} from "react";
import {Play,Download} from "lucide-react";
import * as db from "./db";
import {androidBridge} from "./native";

export function SavedAudio({id}:{id:string}) {
  const [open,setOpen]=useState(false),[url,setUrl]=useState(""),[error,setError]=useState("");
  useEffect(()=>{
    if(!open)return;
    let active=true,objectUrl="";
    const nativeUrl=androidBridge()?.nativeAudioUrl?.(id);
    if(nativeUrl){setUrl(nativeUrl);return;}
    void db.audioBlob(id).then(blob=>{objectUrl=URL.createObjectURL(blob);if(active)setUrl(objectUrl);else URL.revokeObjectURL(objectUrl);}).catch(e=>{if(active)setError(e.message);});
    return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[id,open]);
  async function exportAudio() {
    try {
      const native=androidBridge();
      if(native?.exportNativeAudio){if(!native.exportNativeAudio(id))throw new Error("Could not export the saved audio.");return;}
      const blob=await db.audioBlob(id),href=URL.createObjectURL(blob),anchor=document.createElement("a");
      anchor.href=href;anchor.download=`murmur-${id}.wav`;anchor.click();setTimeout(()=>URL.revokeObjectURL(href),10000);
    }catch(e){setError(e instanceof Error?e.message:"Could not export audio.");}
  }
  return <div className="saved-audio">
    <button className="text-button" onClick={()=>setOpen(!open)}><Play size={14}/>{open?"Hide audio":"Listen"}</button>
    <button className="text-button" onClick={()=>void exportAudio()}><Download size={14}/>Save audio</button>
    {open&&(url?<audio controls preload="metadata" src={url}/>:!error&&<span>Loading audio…</span>)}
    {error&&<span role="alert">{error}</span>}
  </div>;
}
