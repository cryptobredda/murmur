package app.murmur.mobile;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;

/** Runs the actual JNI bridge and streaming C API with a developer-supplied PCM fixture. */
public final class NemotronSmoke {
    public static void main(String[] args) throws Exception {
        byte[] bytes=Files.readAllBytes(Path.of(args[1]));
        int rate=Integer.parseInt(args[2]);long start=System.nanoTime();
        try(NemotronRecognizer asr=new NemotronRecognizer(new File(args[0]))){
            asr.begin(args[3]);
            for(int offset=0;offset<bytes.length;offset+=8192){
                int count=Math.min(8192,bytes.length-offset);float[] audio=new float[count/2];
                for(int i=0;i<audio.length;i++)audio[i]=(short)((bytes[offset+i*2]&255)|(bytes[offset+i*2+1]<<8))/32768f;
                asr.accept(audio,rate);
            }
            String text=asr.finish();
            if(text==null||text.isBlank())throw new AssertionError("Empty streaming result.");
            for(int index=4;index<args.length;index++)if(!text.toLowerCase(java.util.Locale.ROOT).contains(args[index].toLowerCase(java.util.Locale.ROOT)))throw new AssertionError("Missing expected phrase: "+args[index]+"; got: "+text);
            System.out.println(text);System.out.printf("Model load and decode: %.3f seconds%n",(System.nanoTime()-start)/1e9);
        }
    }
}
