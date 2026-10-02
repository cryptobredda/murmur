package app.murmur.mobile;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Button;
import android.widget.Toast;

import androidx.core.content.FileProvider;
import androidx.webkit.ServiceWorkerClientCompat;
import androidx.webkit.ServiceWorkerControllerCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewFeature;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

public final class MainActivity extends Activity {
    private static volatile boolean visible;
    private static java.lang.ref.WeakReference<MainActivity> active = new java.lang.ref.WeakReference<>(null);
    static void backgroundCompleted(){MainActivity activity=active.get();if(activity!=null&&visible)activity.runOnUiThread(()->{if(activity.webView!=null)activity.webView.evaluateJavascript("window.dispatchEvent(new Event('murmur-native-launch'))",null);});}
    static boolean isVisible() { return visible; }
    static void powerChanged(){MainActivity activity=active.get();if(activity!=null)activity.runOnUiThread(()->{
        if(RecordingService.sessionActive())activity.getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        else activity.getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    });}
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final int AUDIO_PERMISSION = 101;
    private static final int CHOOSE_FILE = 102;
    private WebView webView;
    private PermissionRequest pendingAudioRequest;
    private ValueCallback<Uri[]> pendingFileRequest;
    private volatile boolean nativePermissionPending;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        active = new java.lang.ref.WeakReference<>(this);
        FrameLayout frame = new FrameLayout(this);
        frame.setBackgroundColor(Color.rgb(252, 253, 251));
        frame.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        webView = new WebView(this);
        frame.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        setContentView(frame);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        // Android's document picker returns content:// URIs with explicit user grants.
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        webView.setBackgroundColor(Color.rgb(252, 253, 251));
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        webView.addJavascriptInterface(new AndroidBridge(), "MurmurAndroid");

        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .setDomain("appassets.androidplatform.net")
                .addPathHandler("/", this::localAsset)
                .build();
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if(isLocalOrigin(request.getUrl())&&request.getUrl().getPath()!=null&&request.getUrl().getPath().startsWith("/audio/"))return AudioResource.open(MainActivity.this,request);
                return loader.shouldInterceptRequest(request.getUrl());
            }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                // Large local models can exhaust a phone's renderer process. Keep
                // the native activity alive and offer a deliberate restart.
                RecordingService.cancel();
                frame.removeView(view);
                view.destroy();
                webView = null;
                LinearLayout recovery = new LinearLayout(MainActivity.this);
                recovery.setOrientation(LinearLayout.VERTICAL);
                recovery.setPadding(48, 72, 48, 48);
                TextView message = new TextView(MainActivity.this);
                message.setText("Murmur's screen stopped. Your saved history and downloaded files are kept. Restart the app to retry your saved recording. Updating Android System WebView may also help.");
                message.setTextSize(18);
                recovery.addView(message);
                Button retry = new Button(MainActivity.this);
                retry.setText("Restart Murmur");
                retry.setOnClickListener(button -> recreate());
                recovery.addView(retry);
                frame.addView(recovery, new FrameLayout.LayoutParams(-1, -1));
                return true;
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (isLocalOrigin(uri)) return false;
                if ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) { }
                }
                return true;
            }
        });
        if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BASIC_USAGE) &&
                WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_SHOULD_INTERCEPT_REQUEST)) {
            ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(new ServiceWorkerClientCompat() {
                @Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                    return loader.shouldInterceptRequest(request.getUrl());
                }
            });
        }
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    boolean audioOnly = request.getResources().length == 1 &&
                            PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(request.getResources()[0]);
                    if (!isLocalOrigin(request.getOrigin()) || !audioOnly) { request.deny(); return; }
                    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                    } else {
                        if (pendingAudioRequest != null) pendingAudioRequest.deny();
                        pendingAudioRequest = request;
                        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, AUDIO_PERMISSION);
                    }
                });
            }
            @Override public void onPermissionRequestCanceled(PermissionRequest request) {
                if (pendingAudioRequest == request) pendingAudioRequest = null;
            }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pendingFileRequest != null) pendingFileRequest.onReceiveValue(null);
                pendingFileRequest = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json");
                try { startActivityForResult(intent, CHOOSE_FILE); }
                catch (Exception error) { pendingFileRequest = null; callback.onReceiveValue(null); }
                return true;
            }
        });
        webView.loadUrl(ORIGIN + "/index.html");
    }

    private boolean isLocalOrigin(Uri uri) {
        return uri != null && "https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost());
    }

    private WebResourceResponse localAsset(String path) {
        String relative = path.isEmpty() ? "index.html" : path;
        if (relative.contains("..") || relative.startsWith("/")) return missingAsset();
        try {
            InputStream stream = getAssets().open("www/" + relative);
            String mime = mime(relative);
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "max-age=31536000");
            return new WebResourceResponse(mime, mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json") ? "UTF-8" : null,
                    200, "OK", headers, stream);
        } catch (Exception error) { return missingAsset(); }
    }
    private WebResourceResponse missingAsset() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(),
                new ByteArrayInputStream("Not found".getBytes(StandardCharsets.UTF_8)));
    }
    private String mime(String name) {
        if (name.endsWith(".html")) return "text/html";
        if (name.endsWith(".js") || name.endsWith(".mjs")) return "application/javascript";
        if (name.endsWith(".wasm")) return "application/wasm";
        if (name.endsWith(".css")) return "text/css";
        if (name.endsWith(".json")) return "application/json";
        if (name.endsWith(".webmanifest")) return "application/manifest+json";
        if (name.endsWith(".svg")) return "image/svg+xml";
        if (name.endsWith(".png")) return "image/png";
        if (name.endsWith(".woff2")) return "font/woff2";
        return "text/plain";
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent); setIntent(intent);
        if (webView != null) {
            webView.evaluateJavascript("window.dispatchEvent(new Event('murmur-native-launch'))", null);
            // The notification action is consumed once, independently of keyboard launches.
            if ("murmur.finish_recording".equals(intent.getAction()))
                webView.evaluateJavascript("window.dispatchEvent(new Event('murmur-native-finish'))", null);
        }
    }
    @Override protected void onResume() {
        super.onResume();visible=true;MurmurAccessibilityService.pauseEngine();powerChanged();
        if (webView != null) {webView.onResume();webView.evaluateJavascript("window.dispatchEvent(new Event('murmur-native-launch'))",null);}
    }
    @Override protected void onPause() {
        visible=false;
        if(webView!=null)webView.evaluateJavascript("window.dispatchEvent(new Event('murmur-native-background'))",null);
        super.onPause();
    }
    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code == AUDIO_PERMISSION && pendingAudioRequest != null) {
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED)
                pendingAudioRequest.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            else pendingAudioRequest.deny();
            pendingAudioRequest = null;
        }
        if (code == AUDIO_PERMISSION) nativePermissionPending = false;
    }
    @Override protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code == CHOOSE_FILE && pendingFileRequest != null) {
            pendingFileRequest.onReceiveValue(result == RESULT_OK && data != null && data.getData() != null ? new Uri[]{data.getData()} : null);
            pendingFileRequest = null;
        }
    }
    @Override public void onBackPressed() {
        if (RecordingService.isRecording()) {moveTaskToBack(true);return;}
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
    @Override protected void onDestroy() {
        if(active.get()==this)active.clear();
        if (pendingAudioRequest != null) pendingAudioRequest.deny();
        if (pendingFileRequest != null) pendingFileRequest.onReceiveValue(null);
        if (webView != null) { webView.removeJavascriptInterface("MurmurAndroid"); webView.destroy(); }
        super.onDestroy();
    }

    public final class AndroidBridge extends DictationBridge {
        AndroidBridge(){super(MainActivity.this);}
        @JavascriptInterface public String getLaunchContext() {
            try { return new JSONObject().put("version", BuildConfig.VERSION_NAME).toString(); }
            catch (Exception error) { return "{}"; }
        }
        @JavascriptInterface public boolean copyText(String text) {
            if (text == null || text.length() > 1_000_000) return false;
            try { ((ClipboardManager) getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("Murmur dictation", text)); return true; }
            catch (Exception error) { return false; }
        }
        @JavascriptInterface public boolean accessibilityEnabled() {
            String enabled = Settings.Secure.getString(getContentResolver(),Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
            if (enabled == null) return false;
            android.content.ComponentName expected = new android.content.ComponentName(MainActivity.this,MurmurAccessibilityService.class);
            for (String service : enabled.split(":")) if (expected.equals(android.content.ComponentName.unflattenFromString(service))) return true;
            return false;
        }
        @JavascriptInterface public void openAccessibilitySettings() {
            runOnUiThread(() -> startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)));
        }
        @JavascriptInterface public void configureOverlay(boolean enabled,boolean learn) {MurmurAccessibilityService.configure(MainActivity.this,enabled,learn);}
        @JavascriptInterface public void configureOverlayAppearance(double opacity){MurmurAccessibilityService.appearance(MainActivity.this,opacity);}
        @JavascriptInterface public String overlayStatus(){return MurmurAccessibilityService.overlayStatus(MainActivity.this);}
        @JavascriptInterface public void resumeOverlay(){MurmurAccessibilityService.resumeOverlay(MainActivity.this);}
        @JavascriptInterface public String microphonePermission() {
            if (nativePermissionPending) return "pending";
            return checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED?"granted":"denied";
        }
        @JavascriptInterface public void openAppSettings() {
            runOnUiThread(() -> startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()))));
        }
        @JavascriptInterface public void requestMicrophonePermission() {
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED) return;
            nativePermissionPending=true;
            runOnUiThread(() -> requestPermissions(android.os.Build.VERSION.SDK_INT>=33?new String[]{Manifest.permission.RECORD_AUDIO,Manifest.permission.POST_NOTIFICATIONS}:new String[]{Manifest.permission.RECORD_AUDIO},AUDIO_PERMISSION));
        }
        @JavascriptInterface public boolean startNativeRecording() {
            if(MurmurAccessibilityService.backgroundBusy()){RecordingService.failed("A dictation is already running in the floating mic.");return false;}
            RecordingService.newRequest();
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED) {
                RecordingService.failed("Allow Murmur's microphone permission in Android App info, then try again."); return false;
            }
            try {
                android.media.AudioManager audio = (android.media.AudioManager)getSystemService(android.content.Context.AUDIO_SERVICE);
                if (audio != null && audio.isMicrophoneMute()) {
                    RecordingService.failed("Android has muted the microphone. Turn on Microphone access in Quick Settings, close calls, and try again."); return false;
                }
            } catch (Exception ignored) { /* Capture still checks access if this query is unavailable. */ }
            try {startForegroundService(new Intent(MainActivity.this,RecordingService.class));return true;}
            catch(Exception error){RecordingService.failed("Android could not start recording. Open Murmur, allow microphone access, and try again.");return false;}
        }
        @JavascriptInterface public String nativeRecordingStatus() {return RecordingService.status();}
        @JavascriptInterface public String finishNativeRecording() {return RecordingService.finish();}
        @JavascriptInterface public void cancelNativeRecording() {RecordingService.cancel();}
        @JavascriptInterface public String takeLearnedWords() {
            android.content.SharedPreferences prefs=getSharedPreferences("murmur_overlay",MODE_PRIVATE);String words=prefs.getString("learned","[]");prefs.edit().remove("learned").apply();return words;
        }
        @JavascriptInterface public boolean backgroundBusy() { return MurmurAccessibilityService.backgroundBusy(); }
        @JavascriptInterface public void pauseBackgroundEngine() { MurmurAccessibilityService.pauseEngine(); }
        @JavascriptInterface public void resumeBackgroundEngine() { MurmurAccessibilityService.resumeEngine(); }
        @JavascriptInterface public boolean setSessionSecret(String slot,String value) { return NativeSecrets.setSession(slot,value); }
        @JavascriptInterface public String readSecret(String slot) {return NativeSecrets.read(MainActivity.this,slot);}
        @JavascriptInterface public boolean writeSecret(String slot,String value) {return NativeSecrets.write(MainActivity.this,slot,value);}
        @JavascriptInterface public boolean exportNativeAudio(String id) {
            try {
                File directory=new File(getCacheDir(),"exports");if(!directory.exists()&&!directory.mkdirs())return false;
                File file=new File(directory,"murmur-"+id+".wav");RecordingService.journal(MainActivity.this).exportWav(id,file);
                Uri uri=FileProvider.getUriForFile(MainActivity.this,getPackageName()+".files",file);
                Intent share=new Intent(Intent.ACTION_SEND).setType("audio/wav").putExtra(Intent.EXTRA_STREAM,uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                runOnUiThread(()->startActivity(Intent.createChooser(share,"Save your recording")));return true;
            }catch(Exception error){return false;}
        }
        @JavascriptInterface public boolean exportText(String name, String text, String type) {
            if (name == null || text == null || text.length() > 25_000_000) return false;
            String safeName = name.replaceAll("[^A-Za-z0-9._-]", "_");
            if (safeName.isEmpty() || safeName.startsWith(".")) safeName = "murmur-export.json";
            String safeType = "text/plain".equals(type) ? "text/plain" : "application/json";
            try {
                File directory = new File(getCacheDir(), "exports");
                if (!directory.exists() && !directory.mkdirs()) return false;
                File file = new File(directory, safeName);
                try (FileOutputStream stream = new FileOutputStream(file)) { stream.write(text.getBytes(StandardCharsets.UTF_8)); }
                Uri uri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".files", file);
                Intent share = new Intent(Intent.ACTION_SEND).setType(safeType).putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                runOnUiThread(() -> {
                    try { startActivity(Intent.createChooser(share, "Save your Murmur export")); }
                    catch (Exception error) { Toast.makeText(MainActivity.this, "No app is available to save this export.", Toast.LENGTH_LONG).show(); }
                });
                return true;
            } catch (Exception error) { return false; }
        }
    }
}
