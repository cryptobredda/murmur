package app.murmur.mobile;
import org.junit.Test;
import static org.junit.Assert.*;
public class NativeTtsTest {
    @Test public void longReadbackKeepsEveryWordInOrder(){
        String text="A long message should finish reading all its words. ".repeat(100);
        assertEquals(text.trim(),String.join(" ",NativeTts.chunks(text)).replaceAll("\\s+"," "));
    }
    @Test public void unspacedUnicodeReadbackDoesNotSplitSurrogatePairs(){
        String text="a".repeat(399)+"🌿"+"b".repeat(500);
        assertEquals(text,String.join("",NativeTts.chunks(text)));
        for(String part:NativeTts.chunks(text)){
            assertFalse(Character.isLowSurrogate(part.charAt(0)));
            assertFalse(Character.isHighSurrogate(part.charAt(part.length()-1)));
        }
    }
}
