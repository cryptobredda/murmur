package app.murmur.mobile;

import java.io.*;
import java.nio.file.*;
import java.util.*;

/** Private, durable capture files. Reading or ending a session never deletes audio. */
final class AudioJournal {
    final File root;
    AudioJournal(File root) throws IOException {
        this.root = root;
        if (!root.isDirectory() && !root.mkdirs()) throw new IOException("Cannot save audio. Check free device storage.");
    }
    static boolean valid(String id) { return id != null && id.matches("[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}"); }
    File file(String id) {
        if (!valid(id)) throw new IllegalArgumentException("Invalid recording ID.");
        return new File(root, id + ".pcm");
    }
    private File metadata(String id) { file(id); return new File(root, id + ".properties"); }
    synchronized Properties info(String id) throws IOException {
        Properties p = new Properties();
        try (InputStream in = new FileInputStream(metadata(id))) { p.load(in); }
        p.setProperty("bytes", String.valueOf(file(id).length() & ~1L));
        return p;
    }
    synchronized void update(String id, Map<String,String> values) throws IOException {
        Properties p = info(id); p.putAll(values); p.setProperty("updatedAt", Long.toString(System.currentTimeMillis())); write(id,p);
    }
    private void write(String id, Properties p) throws IOException {
        File target = metadata(id), temp = new File(root,id + ".properties.tmp");
        try (FileOutputStream out = new FileOutputStream(temp)) { p.store(out,"Murmur private recording"); out.getFD().sync(); }
        try { Files.move(temp.toPath(),target.toPath(),StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING); }
        catch (AtomicMoveNotSupportedException e) { Files.move(temp.toPath(),target.toPath(),StandardCopyOption.REPLACE_EXISTING); }
    }
    synchronized FileOutputStream create(String id, int sampleRate) throws IOException {
        File audio = file(id);
        if (audio.exists() || metadata(id).exists()) throw new IOException("This recording already exists.");
        FileOutputStream out = new FileOutputStream(audio);
        Properties p = new Properties(); long now = System.currentTimeMillis();
        p.setProperty("id",id); p.setProperty("createdAt",Long.toString(now)); p.setProperty("updatedAt",Long.toString(now));
        p.setProperty("sampleRate",Integer.toString(sampleRate)); p.setProperty("status","recording"); p.setProperty("attempts","0");
        try { write(id,p); return out; } catch (IOException e) { out.close(); throw e; }
    }
    synchronized List<Properties> list(String activeId) throws IOException {
        List<Properties> result = new ArrayList<>();
        File[] files = root.listFiles((dir,name)->name.endsWith(".pcm"));
        if (files == null) return result;
        for (File audio : files) {
            String id = audio.getName().replace(".pcm","");
            if (!valid(id) || audio.length()<2) continue;
            try {
                Properties p = info(id);
                String status = p.getProperty("status","saved");
                if (!id.equals(activeId) && (status.equals("recording") || status.equals("processing"))) {
                    update(id,Map.of("status","saved","error","Processing was interrupted. Your audio is saved.")); p = info(id);
                }
                result.add(p);
            } catch (IOException e) {
                // Recover even if interruption left the very first metadata write unfinished.
                Properties p = new Properties();p.setProperty("id",id);p.setProperty("sampleRate","16000");p.setProperty("status","saved");
                p.setProperty("createdAt",Long.toString(audio.lastModified()));p.setProperty("bytes",Long.toString(audio.length() & ~1L));
                p.setProperty("error","Recording recovered. Your audio is saved.");write(id,p);result.add(p);
            }
        }
        result.sort((a,b)->Long.compare(Long.parseLong(b.getProperty("createdAt","0")),Long.parseLong(a.getProperty("createdAt","0"))));
        return result;
    }
    synchronized boolean delete(String id) {
        File audio = file(id);
        if (audio.exists() && !audio.delete()) return false;
        File meta = metadata(id); return !meta.exists() || meta.delete();
    }
    void exportWav(String id, File destination) throws IOException {
        try(InputStream in=openWav(id);FileOutputStream out=new FileOutputStream(destination)){
            byte[] buffer=new byte[65536];int n;while((n=in.read(buffer))!=-1)out.write(buffer,0,n);out.getFD().sync();
        }
    }
    InputStream openWav(String id) throws IOException {
        Properties p = info(id); int rate = Integer.parseInt(p.getProperty("sampleRate","16000"));
        long length = file(id).length() & ~1L;
        if (length>Integer.MAX_VALUE-44) throw new IOException("Recording is too large to export.");
            java.nio.ByteBuffer h = java.nio.ByteBuffer.allocate(44).order(java.nio.ByteOrder.LITTLE_ENDIAN);
            h.put("RIFF".getBytes(java.nio.charset.StandardCharsets.US_ASCII)).putInt((int)length+36).put("WAVEfmt ".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
            h.putInt(16).putShort((short)1).putShort((short)1).putInt(rate).putInt(rate*2).putShort((short)2).putShort((short)16);
            h.put("data".getBytes(java.nio.charset.StandardCharsets.US_ASCII)).putInt((int)length);
            return new SequenceInputStream(new ByteArrayInputStream(h.array()),new FileInputStream(file(id)));
    }
}
