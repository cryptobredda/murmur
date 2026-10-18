package app.murmur.mobile;

import android.content.Context;
import android.media.*;
import com.k2fsa.sherpa.onnx.*;
import org.json.JSONObject;
import java.io.File;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.*;

/** Optional, user-triggered offline readback. Never speaks over microphone capture. */
final class NativeTts {
    private static NativeTts instance;
    static synchronized NativeTts get(Context context){if(instance==null)instance=new NativeTts(context.getApplicationContext());return instance;}
    private final Context context;
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final Map<String,Job> jobs=new ConcurrentHashMap<>();
    private volatile AudioTrack playing;
    private volatile Job playingJob;
    private NativeTts(Context context){this.context=context;}
    private static final class Job {
        final String id=UUID.randomUUID().toString();
        volatile String state="running",error="";
        volatile boolean cancelled;
    }
    String speak(String text){
        cancelAll();
        if(jobs.size()>32)jobs.entrySet().removeIf(entry->!entry.getValue().state.equals("running"));
        Job job=new Job();jobs.put(job.id,job);worker.execute(()->run(job,text));return job.id;
    }
    private void check(Job job) throws IOException {
        if(job.cancelled||RecordingService.sessionActive())throw new IOException("Readback stopped.");
    }
    private void run(Job job,String text){
        OfflineTts tts=null;
        AudioManager manager=(AudioManager)context.getSystemService(Context.AUDIO_SERVICE);
        AudioFocusRequest focus=new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
            .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
            .setOnAudioFocusChangeListener(change->{if(change<0)cancel(job.id);}).build();
        try {
            check(job);
            if(text==null||text.isBlank()||text.length()>100000)throw new IOException("Choose a transcript with 1–100,000 characters.");
            NativeSpeech speech=NativeSpeech.get(context);
            if(!speech.present("piper-alba"))throw new IOException("Download Piper Alba in Models first.");
            File root=speech.directory("piper-alba");
            OfflineTtsVitsModelConfig vits=new OfflineTtsVitsModelConfig();
            vits.setModel(new File(root,"en_GB-alba-medium.onnx").getAbsolutePath());
            vits.setTokens(new File(root,"tokens.txt").getAbsolutePath());
            vits.setDataDir(new File(root,"espeak-ng-data").getAbsolutePath());
            OfflineTtsModelConfig model=new OfflineTtsModelConfig();model.setVits(vits);model.setNumThreads(2);model.setProvider("cpu");
            OfflineTtsConfig config=new OfflineTtsConfig();config.setModel(model);config.setMaxNumSentences(1);
            tts=new OfflineTts(null,config);check(job);
            if(manager==null||manager.requestAudioFocus(focus)!=AudioManager.AUDIOFOCUS_REQUEST_GRANTED)throw new IOException("Audio is busy. Try readback again later.");
            for(String part:chunks(text)){
                check(job);GeneratedAudio audio=tts.generate(part,0,1f);check(job);play(job,audio);
            }
            check(job);job.state="done";
        }catch(Exception | LinkageError | OutOfMemoryError error){job.error=job.cancelled?"":error.getMessage()==null?"Readback could not start.":error.getMessage();job.state=job.cancelled?"cancelled":"error";}
        finally {if(tts!=null)tts.release();if(manager!=null)manager.abandonAudioFocusRequest(focus);}
    }
    private void play(Job job,GeneratedAudio audio) throws Exception {
        int rate=audio.getSampleRate();float[] samples=audio.getSamples();
        if(samples.length==0)throw new IOException("The voice did not produce audio.");
        int minimum=AudioTrack.getMinBufferSize(rate,AudioFormat.CHANNEL_OUT_MONO,AudioFormat.ENCODING_PCM_FLOAT);
        AudioTrack track=new AudioTrack.Builder()
            .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
            .setAudioFormat(new AudioFormat.Builder().setSampleRate(rate).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).setEncoding(AudioFormat.ENCODING_PCM_FLOAT).build())
            .setBufferSizeInBytes(Math.max(8192,minimum)).setTransferMode(AudioTrack.MODE_STREAM).build();
        playingJob=job;playing=track;
        try {
            track.play();int offset=0;
            while(offset<samples.length){check(job);int written=track.write(samples,offset,Math.min(2048,samples.length-offset),AudioTrack.WRITE_BLOCKING);if(written<=0)throw new IOException("Audio playback interrupted.");offset+=written;}
            long deadline=System.nanoTime()+2_000_000_000L;
            while(Integer.toUnsignedLong(track.getPlaybackHeadPosition())<samples.length&&System.nanoTime()<deadline){check(job);Thread.sleep(20);}
        }finally{playing=null;playingJob=null;track.release();}
    }
    static List<String> chunks(String text){
        List<String> result=new ArrayList<>();int offset=0;
        while(offset<text.length()){
            int end=Math.min(text.length(),offset+400);
            if(end<text.length()){
                int boundary=text.lastIndexOf(' ',end);
                if(boundary>offset+200)end=boundary;
                if(end>offset&&Character.isHighSurrogate(text.charAt(end-1)))end--;
            }
            String part=text.substring(offset,end).trim();if(!part.isEmpty())result.add(part);offset=end;
        }
        return result;
    }
    String status(String id){Job job=jobs.get(id);try{return new JSONObject().put("state",job==null?"cancelled":job.state).put("error",job==null?"":job.error).toString();}catch(Exception ignored){return "{}";}}
    void cancel(String id){Job job=jobs.get(id);if(job!=null)job.cancelled=true;AudioTrack track=playing;if(track!=null&&job==playingJob)try{track.pause();track.flush();}catch(IllegalStateException ignored){}}
    void cancelAll(){for(Job job:jobs.values())job.cancelled=true;AudioTrack track=playing;if(track!=null)try{track.pause();track.flush();}catch(IllegalStateException ignored){}}
    boolean active(){for(Job job:jobs.values())if(job.state.equals("running"))return true;return false;}
}
