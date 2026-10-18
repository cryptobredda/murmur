package app.murmur.mobile;

import java.io.File;
import java.io.IOException;

/** Official NVIDIA GGUF inference; one cached streaming recognizer on the ASR worker. */
final class NemotronRecognizer implements AutoCloseable {
    static { System.loadLibrary("murmur_nemotron"); }
    private long recognizer, stream;
    NemotronRecognizer(File directory) throws IOException {
        recognizer = create(new File(directory, "model.gguf").getAbsolutePath());
        if (recognizer == 0) throw new IOException("Could not load the local speech model.");
    }
    void begin(String language) throws IOException {
        if (stream != 0) { long previous=stream;stream=0;closeStream(previous); }
        stream = start(recognizer, SpeechLanguage.locale(language));
        if (stream == 0) throw new IOException("Could not start local transcription.");
    }
    void accept(float[] samples, int rate) throws IOException { push(stream, samples, rate); }
    String finish() throws IOException { return finish(stream); }
    @Override public void close() {
        if (stream != 0) { closeStream(stream); stream = 0; }
        if (recognizer != 0) { destroy(recognizer); recognizer = 0; }
    }
    private static native long create(String path) throws IOException;
    private static native long start(long recognizer, String language) throws IOException;
    private static native void push(long stream, float[] samples, int rate) throws IOException;
    private static native String finish(long stream) throws IOException;
    private static native void closeStream(long stream);
    private static native void destroy(long recognizer);
}
