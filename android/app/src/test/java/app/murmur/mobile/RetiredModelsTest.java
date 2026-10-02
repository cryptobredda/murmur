package app.murmur.mobile;

import org.junit.Test;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import static org.junit.Assert.*;

public class RetiredModelsTest {
    @Test public void upgradeRemovesOnlyRetiredDownloadsAndDoesNotFollowLinks() throws Exception {
        Path root = Files.createTempDirectory("murmur-model-upgrade");
        for (String name : new String[]{"moonshine-tiny", "moonshine-small", "moonshine-medium", "parakeet-v3", "qwen3-native", "audio"}) {
            Files.createDirectories(root.resolve(name));
            Files.write(root.resolve(name).resolve("saved"), name.getBytes(StandardCharsets.UTF_8));
        }
        Path outside = Files.createTempFile("murmur-recording", ".pcm");
        Files.createSymbolicLink(root.resolve("moonshine-small").resolve("link"), outside);
        RetiredModels.remove(root.toFile());
        RetiredModels.remove(root.toFile());
        for (String name : new String[]{"moonshine-tiny", "moonshine-small", "moonshine-medium"}) assertFalse(Files.exists(root.resolve(name)));
        for (String name : new String[]{"parakeet-v3", "qwen3-native", "audio"}) assertEquals(name, new String(Files.readAllBytes(root.resolve(name).resolve("saved")), StandardCharsets.UTF_8));
        assertTrue(Files.exists(outside));
    }
}
