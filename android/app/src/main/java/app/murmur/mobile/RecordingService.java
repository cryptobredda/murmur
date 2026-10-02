package app.murmur.mobile;

import android.app.Service;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioRecord;
import android.media.AudioFormat;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.net.Uri;
import android.util.Base64;
import org.json.JSONObject;
import java.io.*;
import java.util.*;
import java.nio.file.Files;

/** User-started capture with a durable private journal and active-session foreground lifetime. */
public final class RecordingService extends Service {
    private static volatile RecordingService active;
    private static volatile String lastFailure = "";
    private volatile boolean recording;
    private volatile float level;
    private volatile String error = "";
    private boolean background;
    private String captureRequest = "";
    private volatile boolean session;
    private FileOutputStream output;
    private volatile long bytesCaptured;
    private static AudioJournal journal;
    private int sampleRate = 16000;
    private PowerManager.WakeLock wakeLock;
    private void releaseWakeLock(){if(wakeLock!=null&&wakeLock.isHeld())wakeLock.release();wakeLock=null;}
    private void power(boolean active){session=active;MainActivity.powerChanged();MurmurAccessibilityService.powerChanged();}
    private AudioRecord microphone;
    private Thread capture;
    static synchronized AudioJournal journal(android.content.Context context) throws IOException {
        if(journal==null)journal=new AudioJournal(new File(context.getFilesDir(),"recordings"));return journal;
    }
    static boolean sessionActive(){RecordingService service=active;return service!=null&&service.session;}
    static float currentLevel(){RecordingService service=active;return service==null?0:service.level;}
    static String audioId(){RecordingService service=active;return service==null?"":service.captureRequest;}
    static boolean isClipRecording(String id){RecordingService service=active;return service!=null&&(service.recording||service.capture!=null&&service.capture.isAlive())&&id.equals(service.captureRequest);}
    private void saved(String status,String message) {
        if(!AudioJournal.valid(captureRequest))return;
        try {
            String current=journal(this).info(captureRequest).getProperty("status","");
            if(!current.equals("complete"))journal(this).update(captureRequest,Map.of("status",status,"error",message==null?"":message));
        }catch(Exception ignored){/* PCM remains recoverable even if metadata cannot be written. */}
    }

    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public void onCreate() { super.onCreate(); active = this; }
    static void newRequest() { lastFailure = ""; }
    static void failed(String message) { lastFailure = message; }

    private AudioRecord openMicrophone() {
        // Some OEM audio drivers reject a speech source or a 16 kHz input.
        // Try the ordinary mic and native hardware rates before giving up.
        for (int rate : new int[]{16000, 48000, 44100}) {
            for (int source : new int[]{MediaRecorder.AudioSource.VOICE_RECOGNITION, MediaRecorder.AudioSource.MIC}) {
                AudioRecord candidate = null;
                try {
                    int minimum = AudioRecord.getMinBufferSize(rate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
                    if (minimum <= 0) continue;
                    candidate = new AudioRecord(source, rate, AudioFormat.CHANNEL_IN_MONO,
                            AudioFormat.ENCODING_PCM_16BIT, Math.max(minimum * 2, 8192));
                    if (candidate.getState() != AudioRecord.STATE_INITIALIZED) throw new IllegalStateException();
                    candidate.startRecording();
                    if (candidate.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING) throw new IllegalStateException();
                    sampleRate = rate;
                    return candidate;
                } catch (SecurityException denied) {
                    if (candidate != null) candidate.release();
                    throw denied;
                } catch (Exception unsupported) {
                    if (candidate != null) candidate.release();
                }
            }
        }
        throw new IllegalStateException("The microphone could not start. Close other recording apps or calls, check Android's Microphone access switch, then try again.");
    }

    private Notification notification(boolean processing) {
        NotificationManager manager = (NotificationManager)getSystemService(NOTIFICATION_SERVICE);
        NotificationChannel channel = new NotificationChannel("murmur_voice", "Active dictation", NotificationManager.IMPORTANCE_LOW);
        channel.setSound(null, null); channel.enableVibration(false); channel.setShowBadge(false); manager.createNotificationChannel(channel);
        Notification.Builder builder = new Notification.Builder(this, "murmur_voice")
                .setSmallIcon(android.R.drawable.ic_btn_speak_now).setContentTitle(processing ? "Processing dictation" : "Listening")
                .setOnlyAlertOnce(true).setOngoing(true).setCategory(Notification.CATEGORY_SERVICE);
        if (background) {
            PendingIntent cancel = PendingIntent.getService(this,12,new Intent(this,RecordingService.class).setAction("murmur.background.cancel").setData(Uri.parse("murmur://dictation/"+captureRequest)).putExtra("background_request_id",captureRequest),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
            if (!processing) {
                PendingIntent finish = PendingIntent.getService(this,11,new Intent(this,RecordingService.class).setAction("murmur.background.finish").setData(Uri.parse("murmur://dictation/"+captureRequest)).putExtra("background_request_id",captureRequest),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
                builder.setContentIntent(finish).addAction(new Notification.Action.Builder(android.R.drawable.ic_media_pause,"Finish",finish).build());
            }
            builder.addAction(new Notification.Action.Builder(android.R.drawable.ic_menu_close_clear_cancel,"Cancel",cancel).build());
        } else {
            Intent finish = new Intent(this,MainActivity.class).setAction("murmur.finish_recording").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent action = PendingIntent.getActivity(this,10,finish,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
            builder.setContentIntent(action).addAction(new Notification.Action.Builder(android.R.drawable.ic_media_pause,"Finish",action).build());
        }
        return builder.build();
    }
    @Override public int onStartCommand(Intent intent, int flags, int id) {
        if(intent!=null&&("murmur.background.cancel".equals(intent.getAction())||"murmur.background.finish".equals(intent.getAction()))){
            String actionRequest=intent.getStringExtra("background_request_id");
            if(MurmurAccessibilityService.isBackgroundRequestCurrent(actionRequest==null?"":actionRequest)){
                if("murmur.background.cancel".equals(intent.getAction()))MurmurAccessibilityService.cancelBackground();
                else MurmurAccessibilityService.captureFinished(actionRequest);
            }else if(!recording&&!MurmurAccessibilityService.backgroundBusy())stopSelf(id);
            return START_NOT_STICKY;
        }
        if (recording) return START_NOT_STICKY;
        background = intent != null && intent.getBooleanExtra("background_dictation",false);
        captureRequest = intent == null ? "" : intent.getStringExtra("background_request_id");
        if(background && !MurmurAccessibilityService.isBackgroundRequestCurrent(captureRequest == null ? "" : captureRequest)){stopSelf();return START_NOT_STICKY;}
        if(!AudioJournal.valid(captureRequest))captureRequest=UUID.randomUUID().toString();
        error = ""; lastFailure = "";
        try {
            boolean processing=intent!=null&&"murmur.saved.processing".equals(intent.getAction());
            Notification notification = notification(processing);
            if(processing&&Build.VERSION.SDK_INT>=34)startForeground(10,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE);
            else if (!processing&&Build.VERSION.SDK_INT >= 30) startForeground(10,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
            else startForeground(10,notification);
            releaseWakeLock();
            wakeLock=((PowerManager)getSystemService(POWER_SERVICE)).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"murmur:dictation");
            wakeLock.acquire(2100000);
            power(true);
            if(processing){
                Properties info=journal(this).info(captureRequest);sampleRate=Integer.parseInt(info.getProperty("sampleRate","16000"));bytesCaptured=journal(this).file(captureRequest).length();
                saved("processing","");return START_NOT_STICKY;
            }
            bytesCaptured=0;
            microphone = openMicrophone();
            output=journal(this).create(captureRequest,sampleRate);
            recording = true;
            NativeSpeech.get(this).beginCapture(captureRequest);
            final AudioRecord input = microphone;
            final String recordingRequest = captureRequest;
            capture = new Thread(() -> {
                try{android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_AUDIO);}catch(SecurityException ignored){}
                short[] frame = new short[2048];
                int samples = 0, maximum = sampleRate * 1800;
                long lastSync=System.currentTimeMillis();
                byte[] frameBytes=new byte[frame.length*2];
                try {
                    while (recording && samples < maximum) {
                        int n = input.read(frame, 0, Math.min(frame.length, maximum - samples));
                        if(n<0&&!recording)break;
                        if (n < 0) throw new IllegalStateException("Android stopped the microphone. Close calls or other recording apps, then try again.");
                        double energy = 0;
                            for (int i = 0; i < n; i++) {
                                frameBytes[i*2]=(byte)(frame[i]&255);
                                frameBytes[i*2+1]=(byte)((frame[i]>>8)&255);
                                energy += ((double) frame[i] / 32768) * ((double) frame[i] / 32768);
                            }
                        output.write(frameBytes,0,n*2);bytesCaptured+=n*2L;
                        if(System.currentTimeMillis()-lastSync>=1000){output.getFD().sync();lastSync=System.currentTimeMillis();}
                        samples += n;
                        level = n > 0 ? (float) Math.min(1, Math.sqrt(energy / n) * 12) : 0;
                    }
                } catch (Exception failure) {
                    if (recording) { error = failure.getMessage(); lastFailure = error; }
                } finally {
                    recording = false;
                    level = 0;
                    try { input.stop(); } catch (Exception ignored) { }
                    try{if(output!=null){output.getFD().sync();output.close();output=null;}}catch(Exception failure){if(error.isEmpty())error="Could not finish saving audio. The recorded portion is in History.";}
                    saved(error.isEmpty()?"saved":"failed",error);
                    if (background) {
                        if (!error.isEmpty()) MurmurAccessibilityService.captureFailed(recordingRequest,error);
                        else if (samples >= maximum) MurmurAccessibilityService.captureFinished(recordingRequest);
                    }

                }
            }, "murmur-audio");
            capture.start();
            if (background) MurmurAccessibilityService.captureStarted(captureRequest);
        } catch (Exception failure) {
            error = failure instanceof SecurityException
                    ? "Allow Murmur's microphone permission in Android App info, then try again."
                    : failure.getMessage();
            lastFailure = error == null ? "Android could not open the microphone. Try again." : error;
            recording = false;
            stopCapture();
            saved("failed",lastFailure);
            power(false);
            releaseWakeLock();
            stopForeground(true);
            stopSelf();
            if (background) MurmurAccessibilityService.captureFailed(captureRequest,lastFailure);
        }
        return START_NOT_STICKY;
    }

    static boolean isRecording() { return active != null && active.recording; }
    static boolean hasCapture() {
        RecordingService service = active;
        if (service == null) return false;
        return service.session;
    }
    static String status() {
        try {
            RecordingService service = active;
            long bytes = service == null ? 0 : service.bytesCaptured;
            return new JSONObject().put("recording", service != null && service.recording)
                    .put("ready", service != null && service.session && bytes > 0).put("level", service == null ? 0 : service.level)
                    .put("seconds", service == null ? 0 : bytes / (service.sampleRate * 2.0))
                    .put("sampleRate", service == null ? 16000 : service.sampleRate)
                    .put("audioId",service==null?"":service.captureRequest)
                    .put("error", service == null ? lastFailure : service.error).toString();
        } catch (Exception ignored) { return "{}"; }
    }
    private synchronized void stopCapture() {
        recording = false;
        try { if (microphone != null) microphone.stop(); } catch (Exception ignored) { }
        try { if (capture != null && capture != Thread.currentThread()) capture.join(1500); } catch (InterruptedException ignored) { }
        if (microphone != null) { microphone.release(); microphone = null; }
        capture = null;
        level = 0;
    }
    static void prepareBackgroundProcessing() {
        RecordingService service=active;if(service==null)return;
        service.stopCapture();
        service.saved("processing","");
        if(Build.VERSION.SDK_INT>=34)service.startForeground(10,service.notification(true),ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE);
        else service.startForeground(10,service.notification(true));
    }
    static String takeBackgroundAudio() {
        RecordingService service=active;if(service==null)return "";
        prepareBackgroundProcessing();
        try{return Base64.encodeToString(Files.readAllBytes(journal(service).file(service.captureRequest).toPath()),Base64.NO_WRAP);}
        catch(Exception error){return "";}
    }
    static void endBackgroundSession() {
        RecordingService service=active;if(service==null)return;
        service.power(false);service.releaseWakeLock();service.stopForeground(true);service.stopSelf();
    }
    static String finish() {
        return takeBackgroundAudio();
    }
    private void timedOut(){saved("failed","Processing timed out. Your audio is saved in History.");MurmurAccessibilityService.processingTimedOut();cancel();MainActivity.backgroundCompleted();}
    @Override public void onTimeout(int startId) { timedOut(); }
    @Override public void onTimeout(int startId,int type) { timedOut(); }
    static void cancel() {
        RecordingService service = active;
        if (service == null) return;
        service.stopCapture();
        NativeSpeech.get(service).cancelAudio(service.captureRequest);
        service.saved("saved","Cancelled. Your audio is saved.");
        service.power(false);
        service.releaseWakeLock();
        service.stopForeground(true);
        service.stopSelf();
    }
    @Override public void onDestroy() {
        releaseWakeLock();
        stopCapture();
        if(session)saved("saved","Processing was interrupted. Your audio is saved.");
        power(false);
        if (active == this) active = null;
        super.onDestroy();
    }
}
