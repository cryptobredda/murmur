package app.murmur.mobile;
import org.junit.Test;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import static org.junit.Assert.*;
public class ModelIntegrityTest {
    @Test public void checksumMatchesTheSHA256ReferenceVector() throws Exception {
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",ModelIntegrity.sha256(new ByteArrayInputStream("abc".getBytes(StandardCharsets.US_ASCII))));
    }
    @Test public void checksumMatchesTheCastagnoliReference() throws Exception {
        assertEquals(0xe3069283L,ModelIntegrity.crc32c(new ByteArrayInputStream("123456789".getBytes(StandardCharsets.US_ASCII))));
        assertEquals(0,ModelIntegrity.crc32c(new ByteArrayInputStream(new byte[0])));
    }
}
