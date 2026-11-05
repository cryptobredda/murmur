package app.murmur.mobile;
import org.junit.Test;
import static org.junit.Assert.*;
public class SpeechLanguageTest {
    @Test public void genericLanguagesMapToNativePromptsAndExplicitLocalesArePreserved(){
        assertEquals("en-US",SpeechLanguage.locale("en"));assertEquals("ja-JP",SpeechLanguage.locale("ja"));
        assertEquals("nb-NO",SpeechLanguage.locale("no"));assertEquals("en-GB",SpeechLanguage.locale("en-GB"));
        assertEquals("auto",SpeechLanguage.locale(null));assertEquals("auto",SpeechLanguage.locale("auto"));
    }
}
