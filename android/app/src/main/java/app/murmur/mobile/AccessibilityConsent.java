package app.murmur.mobile;
import android.content.Context;
/** Device-local opt-in; never imported or synchronised from another device. */
final class AccessibilityConsent {
    private static final int VERSION=1;
    static boolean accepted(Context context){return context.getSharedPreferences("murmur_overlay",Context.MODE_PRIVATE).getInt("disclosure_version",0)>=VERSION;}
    static void accept(Context context){context.getSharedPreferences("murmur_overlay",Context.MODE_PRIVATE).edit().putInt("disclosure_version",VERSION).apply();}
    static boolean declined(Context context){return context.getSharedPreferences("murmur_overlay",Context.MODE_PRIVATE).getBoolean("disclosure_declined",false);}
    static void decline(Context context){context.getSharedPreferences("murmur_overlay",Context.MODE_PRIVATE).edit().putBoolean("disclosure_declined",true).apply();}
}
