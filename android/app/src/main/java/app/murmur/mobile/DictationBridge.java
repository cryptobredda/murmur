package app.murmur.mobile;

import android.content.Context;
import android.content.Intent;
import android.webkit.JavascriptInterface;
import android.util.Base64;
import org.json.*;
import java.nio.file.Files;
import java.util.*;

/** Durable audio and native speech APIs, available to both trusted local WebViews. */
public class DictationBridge {
    protected final Context context;
    DictationBridge(Context context){this.context=context;}
    @JavascriptInterface public void configureSpeech(String provider,String model) {
        context.getSharedPreferences("murmur_native_speech",Context.MODE_PRIVATE).edit().putString("provider",provider).putString("model",NativeSpeech.isSpeechModel(model)?model:"parakeet-v3").apply();
    }
    @JavascriptInterface public void configureSpeechLanguage(String language){context.getSharedPreferences("murmur_native_speech",Context.MODE_PRIVATE).edit().putString("language",language==null?"auto":language).apply();}
    @JavascriptInterface public String deviceInfo() {
        try {
            android.app.ActivityManager.MemoryInfo memory = new android.app.ActivityManager.MemoryInfo();
            ((android.app.ActivityManager)context.getSystemService(Context.ACTIVITY_SERVICE)).getMemoryInfo(memory);
            boolean arm64 = java.util.Arrays.asList(android.os.Build.SUPPORTED_64_BIT_ABIS).contains("arm64-v8a");
            return new JSONObject().put("model",android.os.Build.MANUFACTURER+" "+android.os.Build.MODEL)
                .put("androidVersion",android.os.Build.VERSION.RELEASE).put("sdk",android.os.Build.VERSION.SDK_INT)
                .put("ramBytes",memory.totalMem).put("freeStorageBytes",context.getFilesDir().getUsableSpace())
                .put("arm64",arm64).put("soc",android.os.Build.VERSION.SDK_INT>=31?android.os.Build.SOC_MODEL:"").toString();
        } catch(Exception ignored){return "null";}
    }
    @JavascriptInterface public String nativeSpeechModels(){return NativeSpeech.get(context).downloaded();}
    @JavascriptInterface public String prepareNativeSpeech(String model,boolean cacheOnly){return NativeSpeech.get(context).prepare(model,cacheOnly);}
    @JavascriptInterface public String nativeSpeechStatus(String job){return NativeSpeech.get(context).status(job);}
    @JavascriptInterface public void cancelNativeSpeech(String job){NativeSpeech.get(context).cancel(job);}
    @JavascriptInterface public boolean removeNativeSpeech(String model){return NativeSpeech.get(context).remove(model);}
    @JavascriptInterface public String transcribeNativeAudio(String id,String model,boolean fresh){return NativeSpeech.get(context).transcribe(id,model,fresh);}
    @JavascriptInterface public String transcribeNativeAudioWithLanguage(String id,String model,boolean fresh,String language){return NativeSpeech.get(context).transcribe(id,model,fresh,language);}
    @JavascriptInterface public String startNativeModelTrial(String id,String model,String language){return NativeSpeech.get(context).trial(id,model,language);}
    @JavascriptInterface public String speakNativeText(String text){return NativeTts.get(context).speak(text);}
    @JavascriptInterface public String nativeTtsStatus(String job){return NativeTts.get(context).status(job);}
    @JavascriptInterface public void cancelNativeTts(String job){NativeTts.get(context).cancel(job);}
    @JavascriptInterface public String editNativeWriting(String model,String messages,int tokens){return NativeWriting.get(context).edit(model,messages,tokens);}
    @JavascriptInterface public String nativeEditingStatus(String job){return NativeWriting.get(context).status(job);}
    @JavascriptInterface public void cancelNativeEditing(String job){NativeWriting.get(context).cancel(job);}
    @JavascriptInterface public String listNativeAudio() {
        JSONArray clips=new JSONArray();
        try{for(Properties p:RecordingService.journal(context).list(RecordingService.sessionActive()?RecordingService.audioId():""))clips.put(json(p));}
        catch(Exception ignored){}return clips.toString();
    }
    private JSONObject json(Properties p) throws JSONException {
        JSONObject object=new JSONObject();for(String key:p.stringPropertyNames())object.put(key,p.getProperty(key));return object;
    }
    @JavascriptInterface public String nativeAudioInfo(String id) {
        try{return json(RecordingService.journal(context).info(id)).toString();}catch(Exception error){return "{}";}
    }
    @JavascriptInterface public String readNativeAudio(String id) {
        try{return Base64.encodeToString(Files.readAllBytes(RecordingService.journal(context).file(id).toPath()),Base64.NO_WRAP);}catch(Exception error){return "";}
    }
    @JavascriptInterface public String nativeAudioUrl(String id) {
        try{return RecordingService.journal(context).file(id).length()>0?"https://appassets.androidplatform.net/audio/"+id+".wav":"";}catch(Exception error){return "";}
    }
    @JavascriptInterface public boolean updateNativeAudio(String id,String json) {
        try {
            JSONObject object=new JSONObject(json);Map<String,String> fields=new HashMap<>();
            for(String key:List.of("status","error","text","raw","attempts","model","source","style","mode","instruction","originalText","targetApp","processingMs","editingModel","requestedEditingModel"))
                if(object.has(key))fields.put(key,object.optString(key,""));
            RecordingService.journal(context).update(id,fields);return true;
        }catch(Exception error){return false;}
    }
    @JavascriptInterface public boolean deleteNativeAudio(String id) {
        if(RecordingService.sessionActive()&&id.equals(RecordingService.audioId()))return false;
        try{return RecordingService.journal(context).delete(id);}catch(Exception error){return false;}
    }
    @JavascriptInterface public boolean beginSavedProcessing(String id) {
        if(RecordingService.sessionActive())return false;
        try {
            if(RecordingService.journal(context).file(id).length()<2)return false;
            context.startForegroundService(new Intent(context,RecordingService.class).setAction("murmur.saved.processing").putExtra("background_request_id",id));return true;
        }catch(Exception error){return false;}
    }
    @JavascriptInterface public void freezeNativeRecording(){RecordingService.prepareBackgroundProcessing();}
    @JavascriptInterface public void completeAudioProcessing(String id){if(id.equals(RecordingService.audioId()))RecordingService.endBackgroundSession();}
}
