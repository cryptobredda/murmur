package app.murmur.mobile;

import android.Manifest;
import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Point;
import android.graphics.Rect;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;
import java.lang.ref.WeakReference;
import java.util.ArrayDeque;
import java.util.UUID;

/** Automatic field-aware controls. No Activity launch and no global gesture interception. */
public final class MurmurAccessibilityService extends AccessibilityService {
    private static WeakReference<MurmurAccessibilityService> active = new WeakReference<>(null);
    private final Handler handler = new Handler(Looper.getMainLooper());
    private WindowManager manager;
    private LinearLayout bubble;
    private ImageButton mic, cancel;
    private OverlayGlyph glyph;
    private TextView dropTarget;
    private boolean hoveringDrop;
    private WindowManager.LayoutParams position;
    private BackgroundEngine engine;
    private volatile String requestId = "", state = "idle";
    private String retryAudioId="";
    private String targetPackage = "", failure = "";
    private EditorConnection editor;
    private AccessibilityNodeInfo target, eventField, correctionTarget;
    private String expectedText = "", correctionBefore = "";
    private int selectionStart, selectionEnd;
    private long correctionUntil;
    private Runnable correctionTask;
    private float preferredX, preferredY;
    private int anchorX, anchorY;
    private boolean pointerActive;
    private final Runnable refreshTask = this::refresh;
    private final Runnable pulse = new Runnable() {
        @Override public void run() {
            if (manager == null) return;
            PowerManager power = (PowerManager)getSystemService(POWER_SERVICE);
            boolean awake = power == null || power.isInteractive();
            if (awake) refresh(); else if (!busy()) hide();
            handler.postDelayed(this, awake ? 350 : 1500);
        }
    };
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private SharedPreferences preferences() { return getSharedPreferences("murmur_overlay",MODE_PRIVATE); }
    private boolean enabled() { return preferences().getBoolean("enabled",true); }
    private boolean paused(){return OverlayPause.active(preferences().getLong("paused_until",0),System.currentTimeMillis());}
    private boolean busy() { return state.equals("starting") || state.equals("listening") || state.equals("processing"); }
    private Point display() { Point size = new Point(); manager.getDefaultDisplay().getRealSize(size); return size; }

    @Override protected void onServiceConnected() {
        active = new WeakReference<>(this);
        manager = (WindowManager)getSystemService(WINDOW_SERVICE);
        AccessibilityServiceInfo info = getServiceInfo();
        info.flags |= AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS | AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS | AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;
        if (Build.VERSION.SDK_INT >= 33) info.flags |= AccessibilityServiceInfo.FLAG_INPUT_METHOD_EDITOR;
        setServiceInfo(info);
        Point size = display(); float density = getResources().getDisplayMetrics().density;
        preferredX = preferences().getFloat("x_dp", (size.x-dp(68))/density);
        preferredY = preferences().getFloat("y_dp", (size.y*.45f)/density);
        engine = new BackgroundEngine(this);
        String recovery=preferences().getString("retry_audio_id",preferences().getString("active_audio_id",""));
        try {
            if(AudioJournal.valid(recovery)&&RecordingService.journal(this).file(recovery).length()>0&&!RecordingService.journal(this).info(recovery).getProperty("status","").equals("complete")) {
                retryAudioId=recovery;state="error";failure="Your recording is saved. Tap to retry.";
            }
        }catch(Exception ignored){}
        if (!MainActivity.isVisible() && enabled() && !paused()) engine.initialize();
        handler.post(pulse);
    }
    @Override public void onAccessibilityEvent(AccessibilityEvent event) {
        AccessibilityNodeInfo node = event.getSource();
        if ((event.getEventType() == AccessibilityEvent.TYPE_VIEW_FOCUSED || event.getEventType() == AccessibilityEvent.TYPE_VIEW_CLICKED)
                && textField(node)) {
            if (eventField != null) eventField.recycle();
            eventField = AccessibilityNodeInfo.obtain(node);
        }
        if (event.getEventType() == AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED && correctionTarget != null
                && System.currentTimeMillis() < correctionUntil && node != null && correctionTarget.equals(node) && !node.isPassword()) {
            String after = node.getText() == null ? "" : node.getText().toString();
            if (correctionTask != null) handler.removeCallbacks(correctionTask);
            correctionTask = () -> learn(correctionBefore,after);
            handler.postDelayed(correctionTask,5000);
        }
        handler.removeCallbacks(refreshTask);
        handler.postDelayed(refreshTask,80);
    }
    private boolean textField(AccessibilityNodeInfo node) {
        if (node == null || !node.isVisibleToUser() || !node.isEnabled() || node.isPassword() || TextFieldTarget.isSensitive(node.getInputType())
                || node.getPackageName() == null || getPackageName().contentEquals(node.getPackageName())) return false;
        if (node.isEditable()) return true;
        for (AccessibilityNodeInfo.AccessibilityAction action : node.getActionList())
            if (action.getId() == AccessibilityNodeInfo.ACTION_SET_TEXT) return true;
        return node.getClassName() != null && node.getClassName().toString().endsWith("EditText");
    }
    private AccessibilityNodeInfo applicationRoot() {
        for (AccessibilityWindowInfo window : getWindows())
            if (window.getType() == AccessibilityWindowInfo.TYPE_APPLICATION && (window.isActive() || window.isFocused())) {
                AccessibilityNodeInfo root = window.getRoot(); if (root != null) return root;
            }
        return getRootInActiveWindow();
    }
    private String activePackage() {
        AccessibilityNodeInfo root = applicationRoot();
        return root == null || root.getPackageName() == null ? "" : root.getPackageName().toString();
    }
    private boolean keyboardVisible() {
        for (AccessibilityWindowInfo window : getWindows()) if (window.getType() == AccessibilityWindowInfo.TYPE_INPUT_METHOD) return true;
        return false;
    }
    private AccessibilityNodeInfo focusedNode() {
        AccessibilityNodeInfo root = applicationRoot(); if (root == null) return null;
        AccessibilityNodeInfo focus = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
        if (focus != null && (focus.isPassword() || TextFieldTarget.isSensitive(focus.getInputType()))) return null;
        if (textField(focus)) return focus;
        String pkg = root.getPackageName() == null ? "" : root.getPackageName().toString();
        ArrayDeque<AccessibilityNodeInfo> queue = new ArrayDeque<>(); queue.add(root);
        AccessibilityNodeInfo only = null; int count = 0, visited = 0;
        while (!queue.isEmpty() && visited++ < 600) {
            AccessibilityNodeInfo node = queue.removeFirst();
            if (textField(node)) { if (node.isFocused()) return node; only = node; count++; }
            for (int i=0;i<node.getChildCount();i++) { AccessibilityNodeInfo child=node.getChild(i); if(child!=null)queue.add(child); }
        }
        if (keyboardVisible() && eventField != null && eventField.refresh() && textField(eventField)
                && eventField.getPackageName() != null && pkg.contentEquals(eventField.getPackageName())) return eventField;
        return keyboardVisible() && count == 1 ? only : null;
    }
    private boolean hasField() {
        String input = EditorConnection.focusedPackage(this), current = activePackage();
        if (!input.isEmpty() && input.equals(current)) return true;
        return focusedNode() != null;
    }
    private void refresh() {
        if (!enabled() || paused() || (!pointerActive && !busy() && !hasField())) { hide(); return; }
        if (bubble == null) createBubble();
        if (bubble == null) return;
        boolean working = busy();
        ((GradientDrawable)bubble.getBackground()).setColor(state.equals("listening") ? Color.rgb(159,61,47) : Color.rgb(36,98,83));
        ((GradientDrawable)bubble.getBackground()).setCornerRadius(dp(working||state.equals("error")?24:15));
        bubble.setAlpha(OverlayPause.opacity(preferences().getFloat("opacity",1)));
        glyph.setMode(state);
        mic.setContentDescription(state.equals("listening") ? "Finish dictation" : state.equals("processing") ? "Processing dictation" : state.equals("error")&&!retryAudioId.isEmpty()?"Retry saved audio":"Start dictation");
        mic.setEnabled(true);
        if(state.equals("error"))mic.setContentDescription((retryAudioId.isEmpty()?"Start dictation":"Retry saved audio")+". "+failure);
        cancel.setVisibility(working || state.equals("error") ? View.VISIBLE : View.GONE);
        layoutBubble();
    }
    private void createBubble() {
        bubble = new LinearLayout(this); bubble.setOrientation(LinearLayout.HORIZONTAL); bubble.setGravity(Gravity.CENTER_VERTICAL);
        GradientDrawable background = new GradientDrawable(); background.setCornerRadius(dp(busy()||state.equals("error")?24:15)); background.setColor(Color.rgb(36,98,83)); bubble.setBackground(background); bubble.setElevation(dp(6));
        mic = new ImageButton(this); mic.setBackgroundColor(Color.TRANSPARENT); mic.setPadding(dp(10),dp(10),dp(10),dp(10));
        mic.setScaleType(android.widget.ImageView.ScaleType.FIT_CENTER);
        glyph=new OverlayGlyph(dp(28));glyph.setMode(state);mic.setImageDrawable(glyph);
        cancel = new ImageButton(this); cancel.setBackgroundColor(Color.TRANSPARENT); cancel.setImageResource(android.R.drawable.ic_menu_close_clear_cancel); cancel.setImageTintList(android.content.res.ColorStateList.valueOf(Color.WHITE)); cancel.setPadding(dp(10),dp(10),dp(10),dp(10)); cancel.setContentDescription("Cancel dictation"); cancel.setScaleType(android.widget.ImageView.ScaleType.FIT_CENTER);
        mic.setOnClickListener(view -> { if (state.equals("listening")) finishCapture(); else if(state.equals("error")&&!retryAudioId.isEmpty())retrySaved();else if (!busy()) begin(); });
        cancel.setOnClickListener(view -> cancelSession());
        OverlayTouch touch = new OverlayTouch(ViewConfiguration.get(this).getScaledTouchSlop());
        mic.setOnTouchListener(new View.OnTouchListener() {
            int initialX, initialY;
            @Override public boolean onTouch(View view, MotionEvent event) {
                switch(event.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN: pointerActive=true;touch.down(event.getRawX(),event.getRawY()); initialX=anchorX;initialY=anchorY;view.setPressed(true);return true;
                    case MotionEvent.ACTION_MOVE:
                        if(touch.move(event.getRawX(),event.getRawY())) { Point size=display();anchorX=OverlayPlacement.clamp(initialX+Math.round(touch.dx(event.getRawX())),size.x,dp(48),dp(8));anchorY=OverlayPlacement.clamp(initialY+Math.round(touch.dy(event.getRawY())),size.y,dp(48),dp(24));positionBubble();showDropTarget();hoveringDrop=OverlayPause.inTarget(anchorX+dp(24),anchorY+dp(24),size.x,size.y,getResources().getDisplayMetrics().density);if(dropTarget!=null)dropTarget.setAlpha(hoveringDrop?1:.75f); }
                        return true;
                    case MotionEvent.ACTION_UP:
                        pointerActive=false;view.setPressed(false);
                        boolean pause=touch.dragged()&&hoveringDrop;hideDropTarget();
                        if(pause)pauseForTenMinutes();
                        else if(touch.tap(event.getRawX(),event.getRawY()))view.performClick();
                        else if(touch.dragged()){float density=getResources().getDisplayMetrics().density;preferredX=anchorX/density;preferredY=anchorY/density;preferences().edit().putFloat("x_dp",preferredX).putFloat("y_dp",preferredY).apply();layoutBubble();}
                        return true;
                    case MotionEvent.ACTION_CANCEL: pointerActive=false;touch.cancel();view.setPressed(false);hideDropTarget();layoutBubble();return true;
                    case MotionEvent.ACTION_POINTER_DOWN: touch.cancel();hideDropTarget();return true;
                    default:return true;
                }
            }
        });
        position = new WindowManager.LayoutParams(dp(48),dp(48),WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,android.graphics.PixelFormat.TRANSLUCENT);
        position.gravity=Gravity.TOP|Gravity.LEFT;position.softInputMode=WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING;
        if(Build.VERSION.SDK_INT>=30)position.setFitInsetsTypes(0);
        Point size=display();float density=getResources().getDisplayMetrics().density;
        anchorX=OverlayPlacement.restore(preferredX,density,size.x,dp(48),dp(8));anchorY=OverlayPlacement.restore(preferredY,density,size.y,dp(48),dp(24));
        cancel.setVisibility(busy()||state.equals("error")?View.VISIBLE:View.GONE);bubble.setAlpha(OverlayPause.opacity(preferences().getFloat("opacity",1)));
        // Build children before adding the window, so it never flashes at a default corner.
        assemble();setWindowPosition();
        try{manager.addView(bubble,position);}catch(Exception ignored){bubble=null;}
    }
    private boolean leftExpansion;
    private void assemble() {
        bubble.removeAllViews();
        leftExpansion=anchorX>(display().x-dp(48))/2;
        if(leftExpansion){bubble.addView(cancel,new LinearLayout.LayoutParams(dp(40),dp(48)));bubble.addView(mic,new LinearLayout.LayoutParams(dp(48),dp(48)));}
        else{bubble.addView(mic,new LinearLayout.LayoutParams(dp(48),dp(48)));bubble.addView(cancel,new LinearLayout.LayoutParams(dp(40),dp(48)));}
    }
    private void setWindowPosition() {
        if(busy()||RecordingService.sessionActive())position.flags|=WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON;
        else position.flags&=~WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON;
        int extra=cancel.getVisibility()==View.GONE?0:dp(40);
        position.width=dp(48)+extra;position.x=anchorX-(leftExpansion?extra:0);position.y=anchorY;
    }
    private void positionBubble() { if(!pointerActive&&leftExpansion!=(anchorX>(display().x-dp(48))/2))assemble();setWindowPosition();try{manager.updateViewLayout(bubble,position);}catch(Exception ignored){} }
    private void layoutBubble() {
        if(pointerActive)return;
        Point size=display();float density=getResources().getDisplayMetrics().density;
        anchorX=OverlayPlacement.restore(preferredX,density,size.x,dp(48),dp(8));anchorY=OverlayPlacement.restore(preferredY,density,size.y,dp(48),dp(24));
        if(leftExpansion!=(anchorX>(size.x-dp(48))/2))assemble();positionBubble();
    }
    private void hide() { if(bubble!=null){glyph.setVisible(false,false);try{manager.removeView(bubble);}catch(Exception ignored){}bubble=null;}hideDropTarget(); }
    private void showDropTarget() {
        if(dropTarget!=null)return;
        TextView target=new TextView(this);target.setText("×\nPause 10 min");target.setTextColor(Color.WHITE);target.setTextSize(15);target.setGravity(Gravity.CENTER);
        target.setContentDescription("Drop here to pause the floating control for ten minutes");
        GradientDrawable background=new GradientDrawable();background.setColor(Color.rgb(36,98,83));background.setCornerRadius(dp(22));target.setBackground(background);
        Point size=display();WindowManager.LayoutParams p=new WindowManager.LayoutParams(dp(112),dp(76),WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE|WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,android.graphics.PixelFormat.TRANSLUCENT);
        p.gravity=Gravity.TOP|Gravity.LEFT;p.x=(size.x-dp(112))/2;p.y=size.y-dp(108);if(Build.VERSION.SDK_INT>=30)p.setFitInsetsTypes(0);
        try{manager.addView(target,p);dropTarget=target;}catch(Exception ignored){}
    }
    private void hideDropTarget(){if(dropTarget!=null){try{manager.removeView(dropTarget);}catch(Exception ignored){}dropTarget=null;}hoveringDrop=false;}
    private void pauseForTenMinutes(){preferences().edit().putLong("paused_until",System.currentTimeMillis()+OverlayPause.TEN_MINUTES).apply();if(busy()||state.equals("error"))cancelSession();hide();engine.release();NativeWriting.get(this).release();handler.postDelayed(refreshTask,OverlayPause.TEN_MINUTES);}
    private boolean captureDestination() {
        clearDestination();
        editor=EditorConnection.capture(this);
        if(editor!=null && editor.packageName.equals(activePackage())) {targetPackage=editor.packageName;return true;}
        editor=null;
        AccessibilityNodeInfo node=focusedNode();if(node==null)return false;
        String value=node.getText()==null?"":node.getText().toString();if(value.length()>100000)return false;
        target=AccessibilityNodeInfo.obtain(node);targetPackage=node.getPackageName().toString();expectedText=value;
        selectionStart=node.getTextSelectionStart();selectionEnd=node.getTextSelectionEnd();
        if(selectionStart<0||selectionEnd<0){selectionStart=value.length();selectionEnd=selectionStart;}
        selectionStart=Math.min(value.length(),Math.max(0,selectionStart));selectionEnd=Math.min(value.length(),Math.max(selectionStart,selectionEnd));return true;
    }
    private void begin() {
        if(RecordingService.hasCapture()){state="error";failure="Another recording is active.";refresh();return;}
        if(!captureDestination())return;
        if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){engineFailed("Allow microphone access in Murmur.");return;}
        requestId=UUID.randomUUID().toString();retryAudioId="";state="starting";failure="";
        preferences().edit().putString("active_audio_id",requestId).remove("retry_audio_id").apply();
        engine.initialize();refresh();
        try{startForegroundService(new Intent(this,RecordingService.class).putExtra("background_dictation",true).putExtra("background_request_id",requestId));}
        catch(Exception error){engineFailed("Recording unavailable. Check microphone access.");}
    }
    private void finishCapture() {
        if(!state.equals("listening")&&!state.equals("starting"))return;
        // The field the user chooses when finishing becomes the destination.
        captureDestination();state="processing";refresh();
        try{RecordingService.prepareBackgroundProcessing();engine.process(requestId,targetPackage);}
        catch(Exception error){engineFailed("Processing could not start. Tap to retry.");}
    }
    private void cancelSession() {
        preferences().edit().remove("active_audio_id").remove("retry_audio_id").apply();
        requestId="";retryAudioId="";state="idle";engine.cancel();RecordingService.cancel();clearDestination();refresh();MainActivity.backgroundCompleted();
    }
    private void retrySaved() {
        if(busy()||RecordingService.sessionActive())return;
        requestId=retryAudioId;captureDestination();state="processing";failure="";refresh();
        try {
            startForegroundService(new Intent(this,RecordingService.class).setAction("murmur.saved.processing").putExtra("background_dictation",true).putExtra("background_request_id",requestId));
            engine.process(requestId,targetPackage);
        }catch(Exception error){engineFailed("Could not retry. Your recording is in History.");}
    }
    boolean isCurrent(String id){return busy()&&!id.isEmpty()&&id.equals(requestId);}
    void engineFailed(String error){
        String audio=requestId.isEmpty()?RecordingService.audioId():requestId;
        try{retryAudioId=AudioJournal.valid(audio)&&RecordingService.journal(this).file(audio).length()>0?audio:"";}catch(Exception ignored){retryAudioId="";}
        state="error";failure=error;preferences().edit().putString("last_error",error).putString("retry_audio_id",retryAudioId).remove("active_audio_id").apply();engine.cancel();RecordingService.cancel();
        if(!retryAudioId.isEmpty())try{RecordingService.journal(this).update(retryAudioId,java.util.Map.of("status","failed","error",error));}catch(Exception ignored){}
        requestId="";clearDestination();refresh();MainActivity.backgroundCompleted();
    }
    void engineResult(String id,String text,boolean clipboard,String error){
        if(!isCurrent(id))return;
        if(!error.isEmpty()){engineFailed(error);return;}
        boolean inserted=false;
        if(editor!=null && targetPackage.equals(activePackage())){
            inserted=editor.insert(this,text);
            if(inserted){String deliveredPackage=targetPackage;handler.postDelayed(()->{AccessibilityNodeInfo node=focusedNode();if(node!=null&&deliveredPackage.contentEquals(node.getPackageName()))watchCorrection(node,node.getText()==null?"":node.getText().toString());},150);}
        }
        else if(target!=null){
            AccessibilityNodeInfo node=focusedNode();
            String current=node==null||node.getText()==null?"":node.getText().toString();
            if(node!=null&&textField(node)&&target.equals(node)&&targetPackage.contentEquals(node.getPackageName())&&current.equals(expectedText)){
                String prefix=current.substring(0,selectionStart),suffix=current.substring(selectionEnd);
                String value=prefix+(prefix.isEmpty()||Character.isWhitespace(prefix.charAt(prefix.length()-1))?"":" ")+text+(suffix.isEmpty()||Character.isWhitespace(suffix.charAt(0))?"":" ")+suffix;
                Bundle arguments=new Bundle();arguments.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,value);
                inserted=node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,arguments);
                if(inserted){int cursor=value.length()-suffix.length();Bundle selection=new Bundle();selection.putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_START_INT,cursor);selection.putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_END_INT,cursor);node.performAction(AccessibilityNodeInfo.ACTION_SET_SELECTION,selection);watchCorrection(node,value);}
            }
        }
        if(!inserted&&clipboard){try{((ClipboardManager)getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("Murmur",text));Toast.makeText(this,"Copied to clipboard",Toast.LENGTH_SHORT).show();}catch(Exception ignored){}}
        preferences().edit().remove("active_audio_id").remove("retry_audio_id").apply();
        requestId="";retryAudioId="";state="idle";failure="";RecordingService.endBackgroundSession();clearDestination();refresh();MainActivity.backgroundCompleted();
    }
    private void clearDestination(){editor=null;if(target!=null)target.recycle();target=null;expectedText="";targetPackage="";selectionStart=selectionEnd=0;}
    private void watchCorrection(AccessibilityNodeInfo node,String value){
        if(correctionTarget!=null)correctionTarget.recycle();correctionTarget=AccessibilityNodeInfo.obtain(node);correctionBefore=value;correctionUntil=System.currentTimeMillis()+120000;
        long until=correctionUntil;handler.postDelayed(()->{if(correctionUntil==until){correctionBefore="";if(correctionTarget!=null)correctionTarget.recycle();correctionTarget=null;}},120000);
    }
    private void learn(String before,String after){
        if(System.currentTimeMillis()>correctionUntil||!preferences().getBoolean("learn",true)||before.equals(after))return;
        String[] a=before.split("[^\\p{L}\\p{N}'’-]+"),b=after.split("[^\\p{L}\\p{N}'’-]+");if(a.length!=b.length)return;
        int index=-1;for(int i=0;i<a.length;i++)if(!a[i].equals(b[i])){if(index!=-1)return;index=i;}
        if(index<0||a[index].length()<2||b[index].length()<2||a[index].length()>100||b[index].length()>100)return;
        try{JSONArray words=new JSONArray(preferences().getString("learned","[]"));if(words.length()<100){words.put(new JSONObject().put("spoken",a[index]).put("replacement",b[index]));preferences().edit().putString("learned",words.toString()).apply();}correctionBefore=after;}catch(Exception ignored){}
    }
    static void configure(Context context,boolean enabled,boolean learn){context.getSharedPreferences("murmur_overlay",MODE_PRIVATE).edit().putBoolean("enabled",enabled).putBoolean("learn",learn).apply();MurmurAccessibilityService service=active.get();if(service!=null)service.handler.post(service::refresh);}
    static void appearance(Context context,double opacity){context.getSharedPreferences("murmur_overlay",MODE_PRIVATE).edit().putFloat("opacity",OverlayPause.opacity(opacity)).apply();MurmurAccessibilityService service=active.get();if(service!=null)service.handler.post(service::refresh);}
    static String overlayStatus(Context context){try{return new JSONObject().put("pausedUntil",context.getSharedPreferences("murmur_overlay",MODE_PRIVATE).getLong("paused_until",0)).toString();}catch(Exception ignored){return "{}";}}
    static void resumeOverlay(Context context){context.getSharedPreferences("murmur_overlay",MODE_PRIVATE).edit().remove("paused_until").apply();MurmurAccessibilityService service=active.get();if(service!=null)service.handler.post(service::refresh);}
    static boolean isBackgroundRequestCurrent(String id){MurmurAccessibilityService service=active.get();return service!=null&&service.isCurrent(id);}
    static void captureStarted(String id){MurmurAccessibilityService service=active.get();if(service!=null)service.handler.post(()->{if(service.isCurrent(id)&&service.state.equals("starting")){service.state="listening";service.refresh();}});}
    static void captureFinished(String id){MurmurAccessibilityService service=active.get();if(service!=null)service.handler.post(()->{if(service.isCurrent(id))service.finishCapture();});}
    static void captureFinished(){MurmurAccessibilityService service=active.get();if(service!=null)service.handler.post(service::finishCapture);}
    static void captureFailed(String id,String error){MurmurAccessibilityService service=active.get();if(service!=null)service.handler.post(()->{if(service.isCurrent(id))service.engineFailed(error);});}
    static void cancelBackground(){MurmurAccessibilityService service=active.get();if(service!=null)service.handler.post(service::cancelSession);else RecordingService.cancel();}
    static void powerChanged(){MurmurAccessibilityService service=active.get();if(service!=null)service.handler.post(service::refresh);}
    static void processingTimedOut(){MurmurAccessibilityService service=active.get();if(service!=null)service.handler.post(()->{if(service.busy())service.engineFailed("Processing timed out. Your recording is in History.");});}
    static boolean backgroundBusy(){MurmurAccessibilityService service=active.get();return service!=null&&service.busy();}
    static void pauseEngine(){MurmurAccessibilityService service=active.get();if(service!=null)service.handler.post(()->{if(!service.busy()){service.engine.release();}});}
    static void resumeEngine(){MurmurAccessibilityService service=active.get();if(service!=null)service.handler.post(()->{if(service.enabled()&&!service.paused()&&!MainActivity.isVisible()&&!RecordingService.hasCapture()){service.engine.initialize();service.engine.warm();}});}
    // Compatibility for an already pending 0.3 handoff; new overlay sessions never use it.
    @Override public void onInterrupt(){cancelSession();hide();}
    @Override public void onDestroy(){if(busy())RecordingService.cancel();handler.removeCallbacksAndMessages(null);if(engine!=null)engine.release();clearDestination();if(eventField!=null)eventField.recycle();if(correctionTarget!=null)correctionTarget.recycle();hide();if(active.get()==this)active.clear();super.onDestroy();}
}
