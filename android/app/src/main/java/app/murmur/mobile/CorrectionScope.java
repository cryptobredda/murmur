package app.murmur.mobile;

/** Keep automatic learning inside the text Murmur inserted, excluding the rest of a draft. */
final class CorrectionScope {
    final String prefix,suffix;
    CorrectionScope(String text,int start,int end){prefix=text.substring(0,start);suffix=text.substring(end);}
    String inserted(String current){
        if(!current.startsWith(prefix)||!current.endsWith(suffix)||current.length()<prefix.length()+suffix.length())return null;
        return current.substring(prefix.length(),current.length()-suffix.length());
    }
    static CorrectionScope find(String full,String inserted,int cursor){
        int start=cursor>=inserted.length()&&cursor<=full.length()&&full.substring(cursor-inserted.length(),cursor).equals(inserted)?cursor-inserted.length():full.lastIndexOf(inserted);
        if(start<0||inserted.isEmpty()||full.indexOf(inserted)!=full.lastIndexOf(inserted)&&start+inserted.length()!=cursor)return null;
        return new CorrectionScope(full,start,start+inserted.length());
    }
}
