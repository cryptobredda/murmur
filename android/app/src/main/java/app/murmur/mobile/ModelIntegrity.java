package app.murmur.mobile;

import java.io.*;
import java.security.*;

/** Castagnoli CRC used by the publisher's pinned model manifests; portable to API 26. */
final class ModelIntegrity {
    private static final int[] TABLE = new int[256];
    static { for(int i=0;i<256;i++){int c=i;for(int j=0;j<8;j++)c=(c>>>1)^((c&1)!=0?0x82f63b78:0);TABLE[i]=c;} }
    static long crc32c(InputStream input) throws IOException {
        int c=~0; byte[] buffer=new byte[65536];int n;
        while((n=input.read(buffer))!=-1)for(int i=0;i<n;i++)c=TABLE[(c^buffer[i])&255]^(c>>>8);
        return Integer.toUnsignedLong(~c);
    }
    static String sha256(InputStream input) throws IOException {
        try {
            MessageDigest digest=MessageDigest.getInstance("SHA-256");byte[] buffer=new byte[65536];int n;
            while((n=input.read(buffer))!=-1)digest.update(buffer,0,n);
            StringBuilder result=new StringBuilder();for(byte value:digest.digest())result.append(String.format(java.util.Locale.ROOT,"%02x",value&255));return result.toString();
        }catch(NoSuchAlgorithmException error){throw new IOException("Model checksum is unavailable.",error);}
    }
}
