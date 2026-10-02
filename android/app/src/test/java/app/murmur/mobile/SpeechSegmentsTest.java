package app.murmur.mobile;
import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;
public class SpeechSegmentsTest {
    @Test public void forcedBatchesRetainAllSamplesAndOverlapOnlyTheirBoundary() throws Exception {
        List<float[]> batches=new ArrayList<>();List<Boolean> overlap=new ArrayList<>();
        SpeechSegments segments=new SpeechSegments(100,(audio,shared)->{batches.add(audio);overlap.add(shared);});
        float[] original=new float[8200];for(int i=0;i<original.length;i++)original[i]=.01f+i*.00001f;
        for(int i=0;i<original.length;i+=100)segments.accept(Arrays.copyOfRange(original,i,Math.min(original.length,i+100)));segments.finish();
        List<Float> recovered=new ArrayList<>();for(int i=0;i<batches.size();i++)for(int j=overlap.get(i)?60:0;j<batches.get(i).length;j++)recovered.add(batches.get(i)[j]);
        assertEquals(original.length,recovered.size());for(int i=0;i<original.length;i++)assertEquals(original[i],recovered.get(i),0);
        assertFalse(overlap.get(0));assertTrue(overlap.get(1));assertTrue(overlap.get(2));
    }
    @Test public void quietBoundariesKeepAudioAndDoNotDeleteRepeatedWords() throws Exception {
        List<float[]> batches=new ArrayList<>();SpeechSegments segments=new SpeechSegments(100,(audio,overlap)->{assertFalse(overlap);batches.add(audio);});
        float[] speech=new float[100];Arrays.fill(speech,.02f);for(int i=0;i<5;i++)segments.accept(speech);for(int i=0;i<2;i++)segments.accept(new float[100]);segments.finish();
        assertEquals(700,batches.stream().mapToInt(a->a.length).sum());
        assertEquals("This is very very good",SpeechSegments.join("This is very","very good",false));
        assertEquals("Ask what you can do for your country.",SpeechSegments.join("Ask what you can do","you can do for your country.",true));
    }
}
