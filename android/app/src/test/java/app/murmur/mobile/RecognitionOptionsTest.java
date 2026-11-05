package app.murmur.mobile;
import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;
public class RecognitionOptionsTest {
    @Test public void hintsAreBoundedAndCannotInjectScoresOrOtherPhrases(){
        RecognitionOptions options=new RecognitionOptions("accurate",List.of("Leicester","OpenAI","bad :10000","other/phrase","https://secret.example","worse\nter"));
        assertFalse(options.hints.contains(":"));assertFalse(options.hints.contains("bad"));assertFalse(options.hints.contains("other"));assertFalse(options.hints.contains("\n"));assertTrue(options.hints.contains("Leicester"));assertTrue(options.hints.contains("worse ter"));
        List<String>many=new ArrayList<>();for(int i=0;i<300;i++)many.add("Term"+i);assertTrue(new RecognitionOptions("accurate",many).hints.split("/").length<=200);
    }
    @Test public void signaturesTrackAccuracyAndIgnoreDictionaryOrder(){
        assertEquals(new RecognitionOptions("accurate",List.of("Leicester","OpenAI")).signature(),new RecognitionOptions("accurate",List.of("OpenAI","Leicester")).signature());
        assertNotEquals(new RecognitionOptions("fast",List.of("Leicester")).signature(),new RecognitionOptions("accurate",List.of("Leicester")).signature());
        assertEquals("accurate",new RecognitionOptions("unknown",List.of()).mode);
    }
}
