package app.murmur.mobile;

/** Stable download IDs: a new model must not replace a verified older model in place. */
final class SpeechModels {
    static final String DEFAULT = "parakeet-ultra";
    static boolean isParakeet(String model) {
        return "parakeet-ultra".equals(model) || "parakeet-v3".equals(model);
    }
    static boolean isSupported(String model) {
        return isParakeet(model) || "nemotron-multilingual".equals(model) || "nemotron-en".equals(model);
    }
}
