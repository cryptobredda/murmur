package app.murmur.mobile;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewFeature;
import androidx.webkit.ServiceWorkerClientCompat;
import androidx.webkit.ServiceWorkerControllerCompat;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.util.Collections;

/** A local processor page, without an Activity or app switch. */
final class BackgroundEngine {
    private final MurmurAccessibilityService owner;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private WebView webView;
    private boolean ready;
    private JSONObject pending;
    BackgroundEngine(MurmurAccessibilityService owner) { this.owner = owner; }
    void initialize() {
        if (webView != null) return;
        ready = false;
        webView = new WebView(owner);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(false);
        webView.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
        webView.addJavascriptInterface(new Bridge(), "MurmurAndroid");
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder().setDomain("appassets.androidplatform.net")
                .addPathHandler("/", path -> asset(path)).build();
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return true; }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                view.destroy(); webView = null; ready = false; pending = null;
                owner.engineFailed("Try a smaller model.");
                return true;
            }
        });
        if(WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BASIC_USAGE)&&WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_SHOULD_INTERCEPT_REQUEST))
            ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(new ServiceWorkerClientCompat(){
                @Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest request){return loader.shouldInterceptRequest(request.getUrl());}
            });
        webView.onResume();
        webView.loadUrl("https://appassets.androidplatform.net/background.html");
    }
    private WebResourceResponse asset(String path) {
        if (path.contains("..") || path.startsWith("/")) return null;
        try {
            String mime = path.endsWith(".html") ? "text/html" : path.endsWith(".js") || path.endsWith(".mjs") ? "application/javascript"
                    : path.endsWith(".wasm") ? "application/wasm" : path.endsWith(".json") ? "application/json" : "application/octet-stream";
            return new WebResourceResponse(mime, mime.contains("javascript") || mime.startsWith("text/") ? "UTF-8" : null,
                    200, "OK", Collections.emptyMap(), owner.getAssets().open("www/" + path));
        } catch (Exception error) {
            return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
        }
    }
    void process(String id, String packageName) {
        initialize();
        try { pending = new JSONObject().put("id", id).put("packageName", packageName); } catch (Exception ignored) { }
        flush();
    }
    private void flush() {
        if (!ready || webView == null || pending == null) return;
        JSONObject request = pending; pending = null;
        webView.evaluateJavascript("window.MurmurBackground.run(" + request.toString() + ")", null);
    }
    void warm() { if (ready && webView != null) webView.evaluateJavascript("window.MurmurBackground.warm()", null); }
    void cancel() {
        pending = null;
        if (ready && webView != null) webView.evaluateJavascript("window.MurmurBackground.cancel()", null);
    }
    void release() {
        cancel();
        if (webView != null) { webView.removeJavascriptInterface("MurmurAndroid"); webView.destroy(); webView = null; }
        ready = false;
    }
    final class Bridge extends DictationBridge {
        Bridge(){super(owner);}
        @JavascriptInterface public void backgroundReady() { handler.post(() -> { ready = true; flush(); warm(); }); }
        @JavascriptInterface public boolean isBackgroundRequestCurrent(String id) { return owner.isCurrent(id); }
        @JavascriptInterface public void backgroundResult(String id, String text, boolean clipboard, String error) {
            handler.post(() -> owner.engineResult(id, text, clipboard, error));
        }
        @JavascriptInterface public String readSecret(String slot) { return NativeSecrets.read(owner, slot); }
        @JavascriptInterface public boolean writeSecret(String slot, String value) { return NativeSecrets.write(owner, slot, value); }
        @JavascriptInterface public String microphonePermission() { return "granted"; }
        @JavascriptInterface public boolean startNativeRecording() { return false; }
        @JavascriptInterface public String nativeRecordingStatus() { return RecordingService.status(); }
        @JavascriptInterface public String finishNativeRecording() { return RecordingService.takeBackgroundAudio(); }
        @JavascriptInterface public void cancelNativeRecording() { RecordingService.cancel(); }
    }
}
