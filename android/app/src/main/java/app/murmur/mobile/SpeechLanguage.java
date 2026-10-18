package app.murmur.mobile;

import java.util.Map;

final class SpeechLanguage {
    private static final Map<String,String> LOCALES = Map.ofEntries(
        Map.entry("en","en-US"), Map.entry("es","es-ES"), Map.entry("fr","fr-FR"),
        Map.entry("it","it-IT"), Map.entry("pt","pt-BR"), Map.entry("nl","nl-NL"),
        Map.entry("de","de-DE"), Map.entry("tr","tr-TR"), Map.entry("ru","ru-RU"),
        Map.entry("ar","ar-AR"), Map.entry("hi","hi-IN"), Map.entry("ja","ja-JP"),
        Map.entry("ko","ko-KR"), Map.entry("vi","vi-VN"), Map.entry("uk","uk-UA"),
        Map.entry("pl","pl-PL"), Map.entry("sv","sv-SE"), Map.entry("cs","cs-CZ"),
        Map.entry("no","nb-NO"), Map.entry("da","da-DK"), Map.entry("bg","bg-BG"),
        Map.entry("fi","fi-FI"), Map.entry("hr","hr-HR"), Map.entry("sk","sk-SK"),
        Map.entry("zh","zh-CN"), Map.entry("hu","hu-HU"), Map.entry("ro","ro-RO"),
        Map.entry("et","et-EE")
    );
    static String locale(String language) {
        if (language == null || language.equals("auto")) return "auto";
        return LOCALES.getOrDefault(language, language);
    }
}
