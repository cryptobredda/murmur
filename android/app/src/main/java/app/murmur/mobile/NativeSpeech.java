package app.murmur.mobile;

import android.content.Context;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;

/** One native ASR worker shared by the UI and floating mic. No network during dictation. */
final class NativeSpeech {
    private static NativeSpeech instance;
    static synchronized NativeSpeech get(Context context) {
        if(instance==null)instance=new NativeSpeech(context.getApplicationContext());return instance;
    }
    private final Context context;
    private final JSONObject catalog;
    private final ExecutorService downloads=Executors.newSingleThreadExecutor(), inference=Executors.newSingleThreadExecutor();
    private final Map<String,Job> jobs=new ConcurrentHashMap<>(), live=new ConcurrentHashMap<>();
    private ParakeetRecognizer parakeet;
    private NemotronRecognizer nemotron;
    private String loaded="";
    static final class Job {
        final String id=UUID.randomUUID().toString(),model,audioId,language;
        volatile String state="running",file="",error="",text="";
        volatile long loadedBytes,totalBytes;
        volatile boolean cancelled;
        Job(String model,String audioId,String language){this.model=model;this.audioId=audioId;this.language=language;}
        String json() {
            try{return new JSONObject().put("state",state).put("file",file).put("loaded",loadedBytes).put("total",totalBytes).put("error",error).put("text",text).toString();}
            catch(Exception e){return "{}";}
        }
    }
    private NativeSpeech(Context context) {
        this.context=context;
        try(InputStream in=context.getAssets().open("native-models.json");ByteArrayOutputStream bytes=new ByteArrayOutputStream()){
            byte[] buffer=new byte[8192];int n;while((n=in.read(buffer))!=-1)bytes.write(buffer,0,n);
            catalog=new JSONObject(new String(bytes.toByteArray(),StandardCharsets.UTF_8));
        }
        catch(Exception e){throw new IllegalStateException("Speech model catalog is unavailable.",e);}
        downloads.execute(()->RetiredModels.remove(new File(context.getFilesDir(),"speech-models")));
    }
    private JSONObject spec(String model) throws JSONException {
        if(!catalog.has(model))throw new IllegalArgumentException("Unknown native speech model.");return catalog.getJSONObject(model);
    }
    File directory(String model) {
        if(!catalog.has(model))throw new IllegalArgumentException("Unknown native speech model.");
        return new File(context.getFilesDir(),"speech-models/"+model);
    }
    boolean present(String model) {
        try {
            File root=directory(model);if(!new File(root,"verified-v1").isFile())return false;
            JSONArray files=spec(model).getJSONArray("files");
            for(int i=0;i<files.length();i++){JSONObject f=files.getJSONObject(i);if(ModelFiles.resolve(root,f.getString("name")).length()!=f.getLong("size"))return false;}
            return true;
        }catch(Exception e){return false;}
    }
    String downloaded() {
        JSONArray result=new JSONArray();for(Iterator<String> it=catalog.keys();it.hasNext();){String model=it.next();if(present(model))result.put(model);}return result.toString();
    }
    private void check(Job job) throws IOException {if(job.cancelled)throw new IOException("Transcription cancelled. Your audio is saved.");}
    private void verify(File file,JSONObject expected) throws Exception {
        if(file.length()!=expected.getLong("size"))throw new IOException("Incomplete speech model download. Tap Download to resume.");
        if(!"sha256".equals(expected.getString("checksum_type")))throw new IOException("Unsupported model checksum.");
        String actual;try(InputStream in=new FileInputStream(file)){actual=ModelIntegrity.sha256(in);}
        if(!actual.equals(expected.getString("checksum")))throw new IOException("The model download is damaged. Tap Download to retry.");
    }

    private void download(Job job) throws Exception {
        File root=directory(job.model);if(!root.isDirectory()&&!root.mkdirs())throw new IOException("Cannot save this model. Check free storage.");
        JSONArray files=spec(job.model).getJSONArray("files");
        for(int i=0;i<files.length();i++)job.totalBytes+=files.getJSONObject(i).getLong("size");
        long done=0;
        for(int i=0;i<files.length();i++) {
            check(job);JSONObject f=files.getJSONObject(i);String name=f.getString("name");job.file=name;
            File target=ModelFiles.resolve(root,name),part=ModelFiles.resolve(root,name+".part");long size=f.getLong("size");
            if(!target.getParentFile().isDirectory()&&!target.getParentFile().mkdirs())throw new IOException("Cannot create model folder.");
            if(target.isFile()) {
                try{verify(target,f);done+=size;job.loadedBytes=done;continue;}
                catch(IOException invalid){if(!target.delete())throw invalid;}
            }
            long offset=part.length();if(offset>size){if(!part.delete())throw new IOException("Cannot reset incomplete download.");offset=0;}
            if(root.getUsableSpace()<size-offset+16L*1024*1024)throw new IOException("Not enough free storage for this model.");
            URL url=new URL(f.getString("url"));
            if(!"https".equals(url.getProtocol())||!"huggingface.co".equals(url.getHost()))throw new IOException("Invalid model source.");
            if(offset<size) {
                HttpURLConnection connection=(HttpURLConnection)url.openConnection();connection.setConnectTimeout(30000);connection.setReadTimeout(30000);
                connection.setRequestProperty("Accept-Encoding","identity");connection.setRequestProperty("User-Agent","Murmur/0.8 (Android)");if(offset>0)connection.setRequestProperty("Range","bytes="+offset+"-");
                try {
                    int code=connection.getResponseCode();
                    if(code!=200&&code!=206)throw new IOException("Model server returned "+code+". Tap Download to resume.");
                    if(code!=206)offset=0;
                    else if(connection.getHeaderField("Content-Range")==null||!connection.getHeaderField("Content-Range").startsWith("bytes "+offset+"-"))throw new IOException("Invalid resumed download.");
                    try(InputStream in=connection.getInputStream();RandomAccessFile out=new RandomAccessFile(part,"rw")) {
                        out.setLength(offset);out.seek(offset);job.loadedBytes=done+offset;byte[] buffer=new byte[65536];int n;
                        while((n=in.read(buffer))!=-1){check(job);if(offset+n>size)throw new IOException("Unexpected model file size.");out.write(buffer,0,n);offset+=n;job.loadedBytes=done+offset;}
                        out.getFD().sync();
                    }
                }finally{connection.disconnect();}
            }
            try{verify(part,f);}catch(IOException invalid){part.delete();throw invalid;}
            if(!part.renameTo(target))throw new IOException("Could not finish saving the speech model.");
            done+=size;job.loadedBytes=done;
        }
        check(job);try(FileOutputStream out=new FileOutputStream(new File(root,"verified-v1"))){out.write(1);out.getFD().sync();}
    }
    private void load(String model) throws Exception {
        if(model.equals(loaded)&&(parakeet!=null||nemotron!=null))return;
        if(!isSpeechModel(model))throw new IOException("Choose a speech recognition model.");
        if(!present(model))throw new IOException("Download this speech model inside Murmur first.");
        releaseRecognizer();
        if(model.equals("parakeet-v3"))parakeet=new ParakeetRecognizer(directory(model));
        else nemotron=new NemotronRecognizer(directory(model));
        loaded=model;
    }
    static boolean isSpeechModel(String model){return "parakeet-v3".equals(model)||"nemotron-multilingual".equals(model)||"nemotron-en".equals(model);}
    private void releaseRecognizer(){
        if(parakeet!=null){parakeet.close();parakeet=null;}
        if(nemotron!=null){nemotron.close();nemotron=null;}
        loaded="";
    }
    private String language(){return context.getSharedPreferences("murmur_native_speech",Context.MODE_PRIVATE).getString("language","auto");}
    private Job newJob(String model,String audioId,String language){
        if(jobs.size()>64)for(Job old:jobs.values())if(!old.state.equals("running")){jobs.remove(old.id);live.remove(old.audioId,old);}
        Job job=new Job(model,audioId,language);jobs.put(job.id,job);return job;
    }
    String prepare(String model,boolean cacheOnly) {
        Job job=newJob(model,"",language());
        downloads.execute(()->{
            try {
                if(!present(model)){if(cacheOnly)throw new IOException("Download this speech model inside Murmur first.");download(job);}
                check(job);job.file="Preparing speech model";
                inference.execute(()->{try{check(job);String engine=spec(model).optString("engine");if(engine.equals("writing"))NativeWriting.get(context).prepare(directory(model));else if(!engine.equals("tts"))load(model);check(job);job.state="done";}catch(Exception | LinkageError | OutOfMemoryError e){fail(job,e);}});
            }catch(Exception e){fail(job,e);}
        });return job.id;
    }
    void beginCapture(String audioId) {
        android.content.SharedPreferences prefs=context.getSharedPreferences("murmur_native_speech",Context.MODE_PRIVATE);
        String model=prefs.getString("model","parakeet-v3");
        if(prefs.getString("provider","").equals("local")&&isSpeechModel(model)&&present(model))submit(audioId,model,language());
    }
    private Job submit(String audioId,String model,String language) {
        Job job=newJob(model,audioId,language);live.put(audioId,job);inference.execute(()->runAudio(job));return job;
    }
    String transcribe(String audioId,String model,boolean fresh) {
        return transcribe(audioId,model,fresh,language());
    }
    String transcribe(String audioId,String model,boolean fresh,String language) {
        Job existing=live.get(audioId);
        if(!fresh&&existing!=null&&existing.model.equals(model)&&existing.language.equals(language)&&!existing.cancelled&&!existing.state.equals("error"))return existing.id;
        if(existing!=null)existing.cancelled=true;
        return submit(audioId,model,language).id;
    }
    String trial(String audioId,String model,String language){
        Job job=newJob(model,audioId,language);
        inference.execute(()->{
            if(RecordingService.sessionActive()){fail(job,new IOException("Finish dictation before comparing models."));return;}
            NativeTts.get(context).cancelAll();releaseRecognizer();runAudio(job);
        });return job.id;
    }
    private void runAudio(Job job) {
        try { check(job);load(job.model);check(job);if(nemotron!=null)runNemotron(job);else runParakeet(job); }
        catch(Exception | LinkageError | OutOfMemoryError e){fail(job,e);}
        // Release recognition memory after each session; saved audio remains on disk.
        finally{releaseRecognizer();}
    }
    private void runNemotron(Job job) throws Exception {
        AudioJournal journal=RecordingService.journal(context);int rate=Integer.parseInt(journal.info(job.audioId).getProperty("sampleRate","16000"));
        nemotron.begin(job.model.equals("nemotron-en")?"en-US":job.language);
        try(RandomAccessFile input=new RandomAccessFile(journal.file(job.audioId),"r")) {
            byte[] bytes=new byte[8192];
            while(true){
                check(job);long available=(input.length()-input.getFilePointer())&~1L;
                if(available==0){if(!RecordingService.isClipRecording(job.audioId))break;Thread.sleep(20);continue;}
                int n=input.read(bytes,0,(int)Math.min(bytes.length,available));if(n<2)continue;
                float[] samples=new float[n/2];for(int i=0;i<samples.length;i++)samples[i]=(short)((bytes[i*2]&255)|(bytes[i*2+1]<<8))/32768f;
                nemotron.accept(samples,rate);job.loadedBytes=input.getFilePointer();
            }
        }
        check(job);job.text=nemotron.finish().trim();check(job);
        if(job.text.isEmpty())throw new IOException("No words recognized. Your recording is saved in History.");job.state="done";
    }
    private void runParakeet(Job job) throws Exception {
        AudioJournal journal=RecordingService.journal(context);int rate=Integer.parseInt(journal.info(job.audioId).getProperty("sampleRate","16000"));
        StringBuilder result=new StringBuilder();
        SpeechSegments segments=new SpeechSegments(rate,(samples,overlap)->{
            check(job);String text=parakeet.recognize(samples,rate);check(job);
            if(!text.isBlank()){String combined=SpeechSegments.join(result.toString(),text,overlap);result.setLength(0);result.append(combined);}
        });
        try(RandomAccessFile input=new RandomAccessFile(journal.file(job.audioId),"r")) {
            byte[] bytes=new byte[8192];
            while(true){
                check(job);long available=(input.length()-input.getFilePointer())&~1L;
                if(available==0){if(!RecordingService.isClipRecording(job.audioId))break;Thread.sleep(20);continue;}
                int n=input.read(bytes,0,(int)Math.min(bytes.length,available));if(n<2)continue;
                float[] samples=new float[n/2];for(int i=0;i<samples.length;i++)samples[i]=(short)((bytes[i*2]&255)|(bytes[i*2+1]<<8))/32768f;
                segments.accept(samples);job.loadedBytes=input.getFilePointer();
            }
        }
        segments.finish();check(job);job.text=result.toString().trim();
        if(job.text.isEmpty())throw new IOException("No words recognized. Your recording is saved in History.");job.state="done";
    }
    private void fail(Job job,Throwable e){job.error=job.cancelled?"Transcription cancelled. Your audio is saved.":e.getMessage()==null?"Native transcription failed. Your audio is saved.":e.getMessage();job.state="error";}
    String status(String id){Job job=jobs.get(id);return job==null?"{\"state\":\"error\",\"error\":\"Speech job was interrupted. Your audio is saved.\"}":job.json();}
    void cancel(String id){Job job=jobs.get(id);if(job!=null)job.cancelled=true;}
    void cancelAudio(String id){Job job=live.get(id);if(job!=null)job.cancelled=true;}
    boolean remove(String model) {
        if(RecordingService.sessionActive())return false;
        for(Job job:jobs.values())if(job.model.equals(model)&&job.state.equals("running"))return false;
        if(model.equals("piper-alba")&&NativeTts.get(context).active())return false;
        if(model.equals("qwen3-native"))NativeWriting.get(context).release();
        inference.execute(()->{if(model.equals(loaded))releaseRecognizer();});
        return ModelFiles.remove(directory(model));
    }
}
