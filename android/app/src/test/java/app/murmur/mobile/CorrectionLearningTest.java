package app.murmur.mobile;
import org.junit.Test;
import static org.junit.Assert.*;
public class CorrectionLearningTest {
    @Test public void learnsLocalPhraseCorrections(){
        assertArrayEquals(new String[]{"new castle","Newcastle"},CorrectionLearning.learn("Send it to new castle today.","Send it to Newcastle today."));
        assertArrayEquals(new String[]{"worse ter","Worcester"},CorrectionLearning.learn("Add worse ter sauce.","Add Worcester sauce."));
        assertArrayEquals(new String[]{"bishop","Biswaroop"},CorrectionLearning.learn("Hello bishop, how are you?","Hello Biswaroop, how are you?"));
    }
    @Test public void rejectsNumbersNegationCodeAndNewTyping(){
        for(String[]pair:new String[][]{{"We can’t go.","We can go."},{"Dose ٢٣ today.","Dose ٢٤ today."},{"Version Q3 R4","Version Q34 R"},{"It is good.","It is bad."},{"Visit Leicester.","Visit Leicester tomorrow."},{"visit leicester","visit Leicester OK"},{"Use color = 1;","Use colour = 1;"}})assertNull(pair[0],CorrectionLearning.learn(pair[0],pair[1]));
    }
    @Test public void limitsLearningToTheInsertedRegion(){
        CorrectionScope scope=CorrectionScope.find("Earlier draft. Visit Leister tomorrow. End.","Visit Leister tomorrow.",37);
        assertNotNull(scope);assertEquals("Visit Leicester tomorrow.",scope.inserted("Earlier draft. Visit Leicester tomorrow. End."));assertNull(scope.inserted("Changed draft. Visit Leicester tomorrow. End."));
        assertNull(CorrectionScope.find("Same. Same.","Same.",-1));
    }
}
