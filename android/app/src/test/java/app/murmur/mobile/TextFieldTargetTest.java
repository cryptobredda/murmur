package app.murmur.mobile;
import org.junit.Test;
import static org.junit.Assert.*;
public final class TextFieldTargetTest {
    @Test public void onlyOriginalFieldAndRequestReceiveText() {
        TextFieldTarget target=new TextFieldTarget("com.example.notes",42,1,"first",1000);
        assertTrue(target.canInsert("com.example.notes",42,1,"first",2000));
        assertFalse(target.canInsert("com.example.mail",42,1,"first",2000));
        assertFalse(target.canInsert("com.example.notes",43,1,"first",2000));
        assertFalse(target.canInsert("com.example.notes",42,1,"second",2000));
        assertFalse(target.canInsert("com.example.notes",42,2,"first",2000));
    }
    @Test public void staleAndFutureRequestsCannotInsert() {
        TextFieldTarget target=new TextFieldTarget("com.example.notes",42,1,"first",1000);
        assertFalse(target.canInsert("com.example.notes",42,1,"first",999));
        assertFalse(target.canInsert("com.example.notes",42,1,"first",301001));
    }
    @Test public void textAndNumericPasswordsDisableRecording() {
        for(int type:new int[]{0x81,0x91,0xe1,0x12})assertTrue(TextFieldTarget.isSensitive(type));
        assertFalse(TextFieldTarget.isSensitive(1));
        assertFalse(TextFieldTarget.isSensitive(2));
        assertFalse(new TextFieldTarget("com.example.notes",42,0x81,"first",1000).canInsert("com.example.notes",42,0x81,"first",2000));
    }
}
