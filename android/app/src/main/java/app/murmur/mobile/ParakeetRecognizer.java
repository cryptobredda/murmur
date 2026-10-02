package app.murmur.mobile;

import com.k2fsa.sherpa.onnx.*;
import java.io.File;
import java.util.Arrays;

/** Native INT8 TDT decoding; punctuation is part of recognition, not an LLM guess. */
final class ParakeetRecognizer implements AutoCloseable {
    private final OfflineRecognizer recognizer;
    ParakeetRecognizer(File directory) {
        OfflineTransducerModelConfig transducer=new OfflineTransducerModelConfig();
        transducer.setEncoder(new File(directory,"encoder.int8.onnx").getAbsolutePath());
        transducer.setDecoder(new File(directory,"decoder.int8.onnx").getAbsolutePath());
        transducer.setJoiner(new File(directory,"joiner.int8.onnx").getAbsolutePath());
        OfflineModelConfig model=new OfflineModelConfig();model.setTransducer(transducer);
        model.setTokens(new File(directory,"tokens.txt").getAbsolutePath());model.setModelType("nemo_transducer");
        model.setNumThreads(Math.min(4,Math.max(2,Runtime.getRuntime().availableProcessors()/2)));
        OfflineRecognizerConfig config=new OfflineRecognizerConfig();config.setModelConfig(model);
        recognizer=new OfflineRecognizer(null,config);
    }
    String recognize(float[] samples,int rate) {
        OfflineStream stream=recognizer.createStream();
        try {
            // Supply final context without consuming or changing the saved PCM.
            stream.acceptWaveform(Arrays.copyOf(samples,samples.length+Math.round(rate*.3f)),rate);
            recognizer.decode(stream);return recognizer.getResult(stream).getText().trim();
        }finally{stream.release();}
    }
    @Override public void close(){recognizer.release();}
}
