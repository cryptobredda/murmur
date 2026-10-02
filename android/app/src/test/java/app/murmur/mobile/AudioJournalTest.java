package app.murmur.mobile;

import org.junit.Test;
import org.junit.Rule;
import org.junit.rules.TemporaryFolder;
import java.io.*;
import java.nio.file.Files;
import java.util.*;
import static org.junit.Assert.*;

public class AudioJournalTest {
    @Rule public TemporaryFolder temporary=new TemporaryFolder();
    private final String id="00000000-0000-4000-8000-000000000001";
    @Test public void interruptedCaptureIsRecoverableWithoutConsumingAudio() throws Exception {
        File root=temporary.newFolder();AudioJournal journal=new AudioJournal(root);byte[] pcm={1,0,2,0,-1,127};
        try(FileOutputStream out=journal.create(id,48000)){out.write(pcm);out.getFD().sync();}
        AudioJournal reopened=new AudioJournal(root);
        Properties recovered=reopened.list("").get(0);
        assertEquals("saved",recovered.getProperty("status"));assertEquals("48000",recovered.getProperty("sampleRate"));
        assertArrayEquals(pcm,Files.readAllBytes(reopened.file(id).toPath()));
        reopened.update(id,Map.of("status","processing","attempts","1"));
        reopened.update(id,Map.of("status","failed","error","Model stopped"));
        assertArrayEquals(pcm,Files.readAllBytes(reopened.file(id).toPath()));
        assertEquals("failed",new AudioJournal(root).list("").get(0).getProperty("status"));
        reopened.update(id,Map.of("status","complete","text","Recovered dictation"));
        assertEquals("Recovered dictation",new AudioJournal(root).list("").get(0).getProperty("text"));
        assertArrayEquals(pcm,Files.readAllBytes(reopened.file(id).toPath()));
    }
    @Test public void wavExportHasCorrectRateAndRetainsCapture() throws Exception {
        AudioJournal journal=new AudioJournal(temporary.newFolder());byte[] pcm={1,0,2,0,3,0,4,0};
        try(FileOutputStream out=journal.create(id,16000)){out.write(pcm);}
        File wav=temporary.newFile();journal.exportWav(id,wav);byte[] bytes=Files.readAllBytes(wav.toPath());
        java.nio.ByteBuffer header=java.nio.ByteBuffer.wrap(bytes).order(java.nio.ByteOrder.LITTLE_ENDIAN);
        assertEquals(16000,header.getInt(24));assertEquals(pcm.length,header.getInt(40));
        assertArrayEquals(pcm,Arrays.copyOfRange(bytes,44,bytes.length));assertTrue(journal.file(id).isFile());
        assertTrue(journal.delete(id));assertTrue(journal.list("").isEmpty());
    }
    @Test public void activeCaptureIsNotMarkedInterruptedAndIdsCannotEscapeDirectory() throws Exception {
        AudioJournal journal=new AudioJournal(temporary.newFolder());
        try(FileOutputStream out=journal.create(id,16000)){out.write(new byte[]{1,0});}
        assertEquals("recording",journal.list(id).get(0).getProperty("status"));
        assertThrows(IllegalArgumentException.class,()->journal.file("../../private"));
        assertThrows(IOException.class,()->journal.create(id,16000));
    }
}
