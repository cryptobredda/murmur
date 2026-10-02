package app.murmur.mobile;

import java.util.Arrays;

/** Bounded native batches include every captured sample and overlap forced boundaries. */
final class SpeechSegments {
    interface Sink { void accept(float[] audio,boolean overlap) throws Exception; }
    private final int rate,maximum,context;
    private final Sink sink;
    private final float[] buffer;
    private int count,quiet,fresh;
    private boolean overlapping;
    SpeechSegments(int rate,Sink sink) {
        this.rate=rate;this.sink=sink;maximum=rate*35;context=Math.round(rate*.6f);
        buffer=new float[rate*36+8192];
    }
    void accept(float[] audio) throws Exception {
        if(audio.length>8192)throw new IllegalArgumentException("Audio frames must be bounded.");
        System.arraycopy(audio,0,buffer,count,audio.length);count+=audio.length;fresh+=audio.length;
        double energy=0;for(float sample:audio)energy+=sample*sample;
        quiet=audio.length>0&&Math.sqrt(energy/audio.length)<.0015?quiet+audio.length:0;
        boolean forced=count>=maximum;
        if(forced || count>=rate*6&&quiet>=rate*.85f)flush(forced);
    }
    private void flush(boolean forced) throws Exception {
        if(fresh==0)return;
        sink.accept(Arrays.copyOf(buffer,count),overlapping);
        if(forced){System.arraycopy(buffer,count-context,buffer,0,context);count=context;overlapping=true;}
        else{count=0;overlapping=false;}
        fresh=0;quiet=0;
    }
    void finish() throws Exception {flush(false);}
    static String join(String before,String next,boolean overlap) {
        if(before.isBlank())return next;
        if(!overlap)return before+" "+next;
        String[] a=before.trim().split("\\s+"),b=next.trim().split("\\s+");int duplicate=0;
        for(int n=1;n<=Math.min(16,Math.min(a.length,b.length));n++){
            boolean same=true;for(int i=0;i<n;i++)if(!word(a[a.length-n+i]).equals(word(b[i]))){same=false;break;}
            if(same)duplicate=n;
        }
        if(duplicate==b.length)return before;
        return before+" "+String.join(" ",Arrays.copyOfRange(b,duplicate,b.length));
    }
    private static String word(String value){return value.toLowerCase(java.util.Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]","");}
}
