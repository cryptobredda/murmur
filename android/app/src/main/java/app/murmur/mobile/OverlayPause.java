package app.murmur.mobile;

/** Persisted temporary hiding survives service restarts without disabling accessibility. */
final class OverlayPause {
    static final long TEN_MINUTES=600_000L;
    static boolean active(long until,long now){return until>now&&until-now<=TEN_MINUTES;}
    static float opacity(double value){return Double.isFinite(value)?(float)Math.max(.2,Math.min(1,value)):1;}
    static boolean inTarget(int x,int y,int width,int height,float density){return Math.abs(x-width/2f)<=76*density&&y>=height-136*density&&y<=height-12*density;}
}
