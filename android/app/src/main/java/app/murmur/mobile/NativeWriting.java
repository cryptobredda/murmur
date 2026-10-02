package app.murmur.mobile;

import android.content.Context;
import com.google.ai.edge.litertlm.*;
import org.json.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;

/** Native GPU proofreading and explicit writing commands. Each conversation has its own KV cache. */
final class NativeWriting {
    private static NativeWriting instance;
    static synchronized NativeWriting get(Context context){if(instance==null)instance=new NativeWriting(context.getApplicationContext());return instance;}
    private final Context context;
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final Map<String,Job> jobs=new ConcurrentHashMap<>();
    private Engine engine;
    private String loaded="",backend="";
    private NativeWriting(Context context){this.context=context;}
    private static final class Job {
        final String id=UUID.randomUUID().toString();
        volatile String state="running",text="",error="",backend="";
        volatile boolean cancelled;
        volatile Conversation conversation;
    }
    void prepare(File directory) throws Exception {worker.submit(()->{try{load(directory);}catch(Exception error){throw new CompletionException(error);}}).get();}
    private void load(File directory) throws Exception {
        String path=new File(directory,"Qwen3-1.7B_dynamic_wi4b32_afp32.litertlm").getAbsolutePath();
        if(path.equals(loaded)&&engine!=null)return;
        closeEngine();
        try{engine=create(path,new Backend.GPU());backend="gpu";}
        catch(Exception | LinkageError unsupported){closeEngine();engine=create(path,new Backend.CPU(Math.min(4,Math.max(2,Runtime.getRuntime().availableProcessors()/2)),null));backend="cpu";}
        loaded=path;
    }
    private Engine create(String path,Backend backend) {
        Engine next=new Engine(new EngineConfig(path,backend,null,null,4096,null,context.getCacheDir().getAbsolutePath()));
        try{next.initialize();return next;}catch(Exception | LinkageError error){try{next.close();}catch(Exception ignored){}throw error;}
    }
    String edit(String model,String messages,int tokens) {
        if(jobs.size()>32)for(Job old:jobs.values())if(!old.state.equals("running"))jobs.remove(old.id);
        Job job=new Job();jobs.put(job.id,job);
        worker.execute(()->run(job,model,messages,Math.min(1024,Math.max(32,tokens))));return job.id;
    }
    private void check(Job job) throws IOException {if(job.cancelled)throw new IOException("Editing cancelled.");}
    private void run(Job job,String model,String json,int tokens) {
        try {
            check(job);if(!model.equals("qwen3-native")||!NativeSpeech.get(context).present(model))throw new IOException("Download the writing model inside Murmur first.");
            load(NativeSpeech.get(context).directory(model));check(job);job.backend=backend;
            JSONArray messages=new JSONArray(json);String system="",user="";
            for(int i=0;i<messages.length();i++){JSONObject message=messages.getJSONObject(i);if(message.optString("role").equals("system"))system=message.optString("content");else if(message.optString("role").equals("user"))user=message.optString("content");}
            if(user.length()>12000)throw new IOException("This text is too long for the local writing model. Select a shorter passage.");
            ConversationConfig config=new ConversationConfig(Contents.Companion.of(system),Collections.emptyList(),Collections.emptyList(),new SamplerConfig(1,1,0,0),false,null,Map.of("enable_thinking",false),null,false,tokens,new ThinkingConfig(false),false);
            CountDownLatch finished=new CountDownLatch(1);StringBuilder output=new StringBuilder();
            try(Conversation conversation=engine.createConversation(config)) {
                job.conversation=conversation;check(job);
                conversation.sendMessageAsync(user+"\n/no_think",new MessageCallback(){
                    @Override public void onMessage(Message message){synchronized(output){for(Content content:message.getContents().getContents())if(content instanceof Content.Text)output.append(((Content.Text)content).getText());}}
                    @Override public void onDone(){finished.countDown();}
                    @Override public void onError(Throwable error){job.error="The native writing model could not finish. Your original text is kept.";finished.countDown();}
                });
                long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(50);
                while(!finished.await(100,TimeUnit.MILLISECONDS)){check(job);if(System.nanoTime()>deadline)throw new IOException("Writing timed out. Your original text is kept.");}
                check(job);if(!job.error.isEmpty())throw new IOException(job.error);
                synchronized(output){job.text=output.toString().trim();}
                if(job.text.isEmpty())throw new IOException("The writing model returned no text.");job.state="done";
            }finally{job.conversation=null;}
        }catch(Exception | LinkageError error){job.error=job.cancelled?"Editing cancelled.":error.getMessage()==null?"Native editing failed. Your original text is kept.":error.getMessage();job.state="error";}
    }
    String status(String id) {
        Job job=jobs.get(id);try{return job==null?"{\"state\":\"error\",\"error\":\"Editing was interrupted.\"}":new JSONObject().put("state",job.state).put("text",job.text).put("error",job.error).put("backend",job.backend).toString();}catch(Exception error){return "{}";}
    }
    void cancel(String id){Job job=jobs.get(id);if(job!=null){job.cancelled=true;Conversation conversation=job.conversation;if(conversation!=null)try{conversation.cancelProcess();}catch(Exception ignored){}}}
    void release(){for(String id:jobs.keySet())cancel(id);worker.execute(this::closeEngine);}
    private void closeEngine(){if(engine!=null){try{engine.close();}catch(Exception ignored){}engine=null;}loaded="";}
}
