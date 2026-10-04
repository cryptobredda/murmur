package app.murmur.mobile;

import org.junit.Test;
import java.io.IOException;
import java.nio.file.*;
import static org.junit.Assert.*;

public class ModelFilesTest {
    @Test public void nestedVoicePathsStayInsideTheModelFolder() throws Exception {
        Path root=Files.createTempDirectory("murmur-model-files");
        assertEquals(root.resolve("espeak-ng-data/lang/gmw/en").toFile(),ModelFiles.resolve(root.toFile(),"espeak-ng-data/lang/gmw/en"));
        for(String name:new String[]{"../audio.pcm","/tmp/audio.pcm","a/../../b","a//b","a/./b","a\\b",".."}){
            try{ModelFiles.resolve(root.toFile(),name);fail(name);}catch(IOException expected){}
        }
    }
    @Test public void symlinksCannotRedirectDownloadsAndRemovalNeverFollowsThem() throws Exception {
        Path root=Files.createTempDirectory("murmur-model-files"),outside=Files.createTempDirectory("murmur-private-audio");
        Files.write(outside.resolve("saved.pcm"),"keep".getBytes(java.nio.charset.StandardCharsets.UTF_8));Files.createSymbolicLink(root.resolve("linked"),outside);
        try{ModelFiles.resolve(root.toFile(),"linked/saved.pcm");fail("escaped model folder");}catch(IOException expected){}
        Files.createDirectories(root.resolve("espeak-ng-data/lang/gmw"));Files.write(root.resolve("espeak-ng-data/lang/gmw/en"),"voice".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        assertTrue(ModelFiles.remove(root.toFile()));assertFalse(Files.exists(root));assertEquals("keep",new String(Files.readAllBytes(outside.resolve("saved.pcm")),java.nio.charset.StandardCharsets.UTF_8));
    }
}
