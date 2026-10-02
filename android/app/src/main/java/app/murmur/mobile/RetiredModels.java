package app.murmur.mobile;

import java.io.File;
import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;

/** Delete only retired model directories; downloaded Parakeet, Qwen and audio are kept. */
final class RetiredModels {
    static void remove(File modelRoot) {
        for (String name : new String[]{"moonshine-tiny", "moonshine-small", "moonshine-medium"}) {
            Path path = new File(modelRoot, name).toPath();
            if (!Files.exists(path, LinkOption.NOFOLLOW_LINKS)) continue;
            try {
                // walkFileTree does not follow symbolic links.
                Files.walkFileTree(path, new SimpleFileVisitor<Path>() {
                    @Override public FileVisitResult visitFile(Path file, BasicFileAttributes attributes) throws IOException {
                        Files.delete(file); return FileVisitResult.CONTINUE;
                    }
                    @Override public FileVisitResult postVisitDirectory(Path directory, IOException error) throws IOException {
                        if (error != null) throw error;
                        Files.delete(directory); return FileVisitResult.CONTINUE;
                    }
                });
            } catch (IOException ignored) { /* A later launch can finish removing unused files. */ }
        }
    }
}
