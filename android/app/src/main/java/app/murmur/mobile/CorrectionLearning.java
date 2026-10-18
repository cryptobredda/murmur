package app.murmur.mobile;

import java.util.*;
import java.util.regex.*;

/** Short settled word/phrase edits only; quantities and negations never become aliases. */
final class CorrectionLearning {
    private static final Pattern WORD=Pattern.compile("[\\p{L}\\p{N}]+(?:['’-][\\p{L}\\p{N}]+)*");
    static String[] learn(String before,String after){
        if(Pattern.compile("[{};=<>]|https?://|\\S+@\\S+").matcher(before+after).find())return null;
        List<String>a=words(before),b=words(after);int start=0,endA=a.size(),endB=b.size();
        while(start<endA&&start<endB&&a.get(start).equals(b.get(start)))start++;
        while(endA>start&&endB>start&&a.get(endA-1).equals(b.get(endB-1))){endA--;endB--;}
        if(endA==start||endB==start||endA-start>4||endB-start>4)return null;
        List<String>old=a.subList(start,endA),next=b.subList(start,endB);String spoken=String.join(" ",old),replacement=String.join(" ",next);
        if(old.size()==1&&next.size()>1&&old.get(0).equalsIgnoreCase(next.get(0)))return null;
        if(spoken.length()<2||replacement.length()<2||spoken.length()>100||replacement.length()>100)return null;
        Pattern unsafe=Pattern.compile("(?i)(?:\\d+|no|not|never|yes|can|cannot|can't|could|couldn't|will|won't|should|shouldn't|don't|doesn't|isn't|wasn't|weren't|good|bad|true|false)");
        for(String word:old)if(unsafe.matcher(word.replace("’","'")).matches()||word.matches("\\p{N}+"))return null;for(String word:next)if(unsafe.matcher(word.replace("’","'")).matches()||word.matches("\\p{N}+"))return null;
        if(!numbers(spoken).equals(numbers(replacement)))return null;
        if(old.size()>1||next.size()>1){
            String x=spoken.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]",""),y=replacement.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]","");
            int[] row=new int[y.length()+1];for(int j=0;j<row.length;j++)row[j]=j;
            for(int i=1;i<=x.length();i++){int[] current=new int[y.length()+1];current[0]=i;for(int j=1;j<=y.length();j++)current[j]=Math.min(Math.min(current[j-1]+1,row[j]+1),row[j-1]+(x.charAt(i-1)==y.charAt(j-1)?0:1));row=current;}
            if(1-(double)row[y.length()]/Math.max(x.length(),y.length())<.72)return null;
        }
        return new String[]{spoken,replacement};
    }
    private static List<String> words(String value){List<String>words=new ArrayList<>();Matcher matcher=WORD.matcher(value);while(matcher.find())words.add(matcher.group());return words;}
    private static List<String> numbers(String value){List<String>values=new ArrayList<>();Matcher matcher=Pattern.compile("\\p{N}+").matcher(value);while(matcher.find())values.add(matcher.group());return values;}
}
