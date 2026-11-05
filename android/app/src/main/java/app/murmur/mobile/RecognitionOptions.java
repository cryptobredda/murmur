package app.murmur.mobile;

import java.text.Normalizer;
import java.util.*;

/** Immutable settings copied into a recognition job, including safe contextual hints. */
final class RecognitionOptions {
    final String mode,hints;
    RecognitionOptions(String mode,Collection<String> words){
        this.mode="fast".equals(mode)?"fast":"accurate";
        LinkedHashSet<String> phrases=new LinkedHashSet<>();
        for(String value:words){
            if(value==null)continue;
            String term=Normalizer.normalize(value,Normalizer.Form.NFKC).trim().replaceAll("\\s+"," ");
            if(term.length()<2||term.length()>100||!term.matches("[\\p{L}\\p{M}\\p{N}][\\p{L}\\p{M}\\p{N}'’+.#&() -]*"))continue;
            if(term.split(" ").length>5)continue;
            if(phrases.size()<200)phrases.add(term);if(phrases.size()<200)phrases.add(term.toLowerCase(Locale.ROOT));
            if(phrases.size()>=200)break;
        }
        hints=String.join("/",new TreeSet<>(phrases));
    }
    String signature(){return mode+"\n"+hints;}
}
