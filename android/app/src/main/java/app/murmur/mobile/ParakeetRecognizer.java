package app.murmur.mobile;

import com.k2fsa.sherpa.onnx.*;
import java.io.File;
import java.util.Arrays;
import android.content.Context;
import java.io.*;

/** Native INT8 TDT decoding; punctuation is part of recognition, not an LLM guess. */
final class ParakeetRecognizer implements AutoCloseable {
    private OfflineRecognizer recognizer;
    private final OfflineRecognizerConfig config;
    private boolean beam;
    private final RecognitionOptions options;
    ParakeetRecognizer(Context context,File directory,RecognitionOptions options) throws IOException {
        this.options=options;
        OfflineTransducerModelConfig transducer=new OfflineTransducerModelConfig();
        transducer.setEncoder(new File(directory,"encoder.int8.onnx").getAbsolutePath());
        transducer.setDecoder(new File(directory,"decoder.int8.onnx").getAbsolutePath());
        transducer.setJoiner(new File(directory,"joiner.int8.onnx").getAbsolutePath());
        OfflineModelConfig model=new OfflineModelConfig();model.setTransducer(transducer);
        model.setTokens(new File(directory,"tokens.txt").getAbsolutePath());model.setModelType("nemo_transducer");
        model.setNumThreads(Math.min(4,Math.max(2,Runtime.getRuntime().availableProcessors()/2)));
        config=new OfflineRecognizerConfig();config.setModelConfig(model);
        if(!options.mode.equals("fast")&&!options.hints.isEmpty()){
            File vocabulary=new File(context.getCacheDir(),"parakeet-bpe-v1.vocab");
            // The small tokenizer vocabulary is an attributed APK asset, never a network dependency.
            try(InputStream in=context.getAssets().open("speech/parakeet-v3.vocab");OutputStream out=new FileOutputStream(vocabulary)){
                byte[] bytes=new byte[8192];int n;while((n=in.read(bytes))!=-1)out.write(bytes,0,n);
            }
            model.setModelingUnit("bpe");model.setBpeVocab(vocabulary.getAbsolutePath());
            config.setDecodingMethod("modified_beam_search");config.setMaxActivePaths(4);config.setHotwordsScore(.8f);
            beam=true;
        }
        recognizer=new OfflineRecognizer(null,config);
    }
    String recognize(float[] samples,int rate) {
        String text=decode(samples,rate);
        if(text.isBlank()&&beam){
            // A beam can exhaust its paths on short/quiet speech. Reuse the same samples,
            // freeing that model before the fallback so memory does not double.
            recognizer.release();beam=false;config.setDecodingMethod("greedy_search");
            recognizer=new OfflineRecognizer(null,config);text=decode(samples,rate);
        }
        return text;
    }
    private String decode(float[] samples,int rate){
        OfflineStream stream=beam&&!options.hints.isEmpty()?recognizer.createStream(options.hints):recognizer.createStream();
        try {
            // Supply final context without consuming or changing the saved PCM.
            stream.acceptWaveform(Arrays.copyOf(samples,samples.length+Math.round(rate*.3f)),rate);
            recognizer.decode(stream);return recognizer.getResult(stream).getText().trim();
        }finally{stream.release();}
    }
    @Override public void close(){recognizer.release();}
}
