package app.murmur.mobile;

import android.accessibilityservice.AccessibilityService;
import android.os.Build;
import android.view.inputmethod.EditorInfo;

/** Android 13's accessibility editor connection works alongside the user's keyboard. */
final class EditorConnection {
    private final Object editor, connection;
    final String packageName;
    private final int inputType, fieldId;
    private final String surrounding;
    private final int start, end;
    private final long capturedAt = System.currentTimeMillis();
    private EditorConnection(Object editor, Object connection, String packageName, int inputType, int fieldId,
                             String surrounding, int start, int end) {
        this.editor = editor; this.connection = connection; this.packageName = packageName;
        this.inputType = inputType; this.fieldId = fieldId; this.surrounding = surrounding; this.start = start; this.end = end;
    }
    static String focusedPackage(AccessibilityService service) {
        if (Build.VERSION.SDK_INT < 33) return "";
        return Api33.focusedPackage(service);
    }
    static EditorConnection capture(AccessibilityService service) {
        if (Build.VERSION.SDK_INT < 33) return null;
        return Api33.capture(service);
    }
    boolean insert(AccessibilityService service, String text) {
        return Build.VERSION.SDK_INT >= 33 && Api33.insert(service, this, text);
    }
    @androidx.annotation.RequiresApi(33)
    private static final class Api33 {
        static String focusedPackage(AccessibilityService service) {
            android.accessibilityservice.InputMethod method = service.getInputMethod();
            if (method == null || !method.getCurrentInputStarted()) return "";
            EditorInfo info = method.getCurrentInputEditorInfo();
            return info != null && info.packageName != null && !service.getPackageName().equals(info.packageName)
                    && !TextFieldTarget.isSensitive(info.inputType) && method.getCurrentInputConnection() != null ? info.packageName : "";
        }
        static EditorConnection capture(AccessibilityService service) {
            try {
                android.accessibilityservice.InputMethod method = service.getInputMethod();
                if (method == null || focusedPackage(service).isEmpty()) return null;
                EditorInfo info = method.getCurrentInputEditorInfo();
                android.accessibilityservice.InputMethod.AccessibilityInputConnection connection = method.getCurrentInputConnection();
                android.view.inputmethod.SurroundingText text = connection.getSurroundingText(128, 128, 0);
                return new EditorConnection(info, connection, info.packageName, info.inputType, info.fieldId,
                        text == null ? null : text.getText().toString(), text == null ? 0 : text.getSelectionStart(),
                        text == null ? 0 : text.getSelectionEnd());
            } catch (Exception ignored) { return null; }
        }
        static boolean insert(AccessibilityService service, EditorConnection target, String text) {
            try {
                if (System.currentTimeMillis() - target.capturedAt > 180000) return false;
                android.accessibilityservice.InputMethod method = service.getInputMethod();
                if (method == null || !method.getCurrentInputStarted()) return false;
                EditorInfo current = method.getCurrentInputEditorInfo();
                // EditorInfo is replaced for a new connection, including fields with ID zero.
                if (current != target.editor || !target.packageName.equals(current.packageName)
                        || target.fieldId != current.fieldId || target.inputType != current.inputType || TextFieldTarget.isSensitive(current.inputType)) return false;
                android.accessibilityservice.InputMethod.AccessibilityInputConnection connection = method.getCurrentInputConnection();
                if (connection == null) return false;
                android.view.inputmethod.SurroundingText now = connection.getSurroundingText(128,128,0);
                if (target.surrounding != null && (now == null || !target.surrounding.equals(now.getText().toString())
                        || target.start != now.getSelectionStart() || target.end != now.getSelectionEnd())) return false;
                String prefix = target.surrounding == null ? "" : target.surrounding.substring(0,target.start);
                String suffix = target.surrounding == null ? "" : target.surrounding.substring(target.end);
                String insertion = (prefix.isEmpty() || Character.isWhitespace(prefix.charAt(prefix.length()-1)) ? "" : " ")
                        + text + (suffix.isEmpty() || Character.isWhitespace(suffix.charAt(0)) ? "" : " ");
                connection.commitText(insertion, 1, null);
                return true;
            } catch (Exception ignored) { return false; }
        }
    }
}
