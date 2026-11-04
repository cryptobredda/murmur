package app.murmur.mobile;

import org.junit.Test;
import static org.junit.Assert.*;

public class SpeechModelsTest {
    @Test public void ultraAndOriginalUseTheSameParakeetEngine() {
        assertEquals("parakeet-ultra", SpeechModels.DEFAULT);
        for (String model : new String[]{"parakeet-ultra", "parakeet-v3"}) {
            assertTrue(SpeechModels.isSupported(model));
            assertTrue(SpeechModels.isParakeet(model));
        }
        for (String model : new String[]{"nemotron-multilingual", "nemotron-en"}) {
            assertTrue(SpeechModels.isSupported(model));
            assertFalse(SpeechModels.isParakeet(model));
        }
    }
    @Test public void nonSpeechAndRetiredIdsCannotReachTheRecognizer() {
        for (String model : new String[]{"qwen3-native", "piper-alba", "moonshine-medium", "unknown", ""}) {
            assertFalse(SpeechModels.isSupported(model));
            assertFalse(SpeechModels.isParakeet(model));
        }
        assertFalse(SpeechModels.isSupported(null));
    }
}
