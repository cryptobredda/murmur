package app.murmur.mobile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;

/** Catalog paths may contain subdirectories, but never escape their model folder. */
final class ModelFiles {
    static File resolve(File root, String name) throws IOException {
        if (name == null || !name.matches("[A-Za-z0-9._-]+(?:/[A-Za-z0-9._-]+)*"))
            throw new IOException("Invalid model filename.");
        for (String segment : name.split("/"))
            if (segment.equals(".") || segment.equals("..")) throw new IOException("Invalid model filename.");
        File target = new File(root, name);
        if (!target.getCanonicalPath().startsWith(root.getCanonicalPath() + File.separator))
            throw new IOException("Invalid model path.");
        return target;
    }
    static boolean remove(File file) {
        if (Files.isSymbolicLink(file.toPath())) return file.delete();
        File[] children = file.listFiles();
        if (children != null) for (File child : children) if (!remove(child)) return false;
        return !file.exists() || file.delete();
    }
}
