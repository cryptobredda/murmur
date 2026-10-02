package app.murmur.mobile;

import android.text.InputType;

/** Selection identity only. No text from the destination app is collected. */
public final class TextFieldTarget {
    public final String packageName;
    public final int fieldId;
    public final int inputType;
    public final String requestId;
    public final long requestedAt;

    public TextFieldTarget(String packageName, int fieldId, int inputType, String requestId, long requestedAt) {
        this.packageName = packageName;
        this.fieldId = fieldId;
        this.inputType = inputType;
        this.requestId = requestId;
        this.requestedAt = requestedAt;
    }

    public static boolean isSensitive(int inputType) {
        int category = inputType & InputType.TYPE_MASK_CLASS;
        int variation = inputType & InputType.TYPE_MASK_VARIATION;
        return category == InputType.TYPE_CLASS_TEXT &&
                (variation == InputType.TYPE_TEXT_VARIATION_PASSWORD ||
                 variation == InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD ||
                 variation == InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD) ||
                category == InputType.TYPE_CLASS_NUMBER && variation == InputType.TYPE_NUMBER_VARIATION_PASSWORD;
    }

    public boolean canInsert(String currentPackage, int currentFieldId, int currentType, String latestRequestId, long now) {
        return packageName != null && packageName.equals(currentPackage) &&
                fieldId == currentFieldId && inputType == currentType &&
                requestId != null && requestId.equals(latestRequestId) &&
                now >= requestedAt && now - requestedAt <= 300_000 &&
                !isSensitive(inputType) && !isSensitive(currentType);
    }
}
