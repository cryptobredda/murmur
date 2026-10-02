package app.murmur.mobile;

import android.content.Context;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import java.io.*;
import java.util.*;

/** Streams private WAV playback, including seek requests, without duplicating audio in JS memory. */
final class AudioResource {
    static WebResourceResponse open(Context context,WebResourceRequest request) {
        try {
            String path=request.getUrl().getPath();
            if(path==null||!path.startsWith("/audio/")||!path.endsWith(".wav"))return null;
            String id=path.substring(7,path.length()-4);
            AudioJournal journal=RecordingService.journal(context);long total=(journal.file(id).length()&~1L)+44;
            if(total<46)return missing();
            String range=null;for(Map.Entry<String,String> header:request.getRequestHeaders().entrySet())if(header.getKey().equalsIgnoreCase("Range"))range=header.getValue();
            long start=0,end=total-1;
            if(range!=null&&range.matches("bytes=\\d+-\\d*")) {
                String[] parts=range.substring(6).split("-",-1);start=Long.parseLong(parts[0]);if(!parts[1].isEmpty())end=Math.min(end,Long.parseLong(parts[1]));
                if(start>end)return new WebResourceResponse("audio/wav",null,416,"Range Not Satisfiable",Map.of("Content-Range","bytes */"+total),new ByteArrayInputStream(new byte[0]));
            }else range=null;
            InputStream input=journal.openWav(id);
            try{long left=start;while(left>0){long n=input.skip(left);if(n==0){if(input.read()<0)throw new EOFException();n=1;}left-=n;}}
            catch(Exception e){input.close();throw e;}
            long length=end-start+1;Map<String,String> headers=new HashMap<>();headers.put("Cache-Control","no-store");headers.put("Accept-Ranges","bytes");headers.put("Content-Length",Long.toString(length));
            if(range!=null)headers.put("Content-Range","bytes "+start+"-"+end+"/"+total);
            final long count=length;
            InputStream limited=new FilterInputStream(input){long remaining=count;
                @Override public int read() throws IOException{if(remaining<=0)return -1;int n=super.read();if(n>=0)remaining--;return n;}
                @Override public int read(byte[] b,int o,int n) throws IOException{if(remaining<=0)return -1;int got=in.read(b,o,(int)Math.min(n,remaining));if(got>0)remaining-=got;return got;}
            };
            return new WebResourceResponse("audio/wav",null,range==null?200:206,range==null?"OK":"Partial Content",headers,limited);
        }catch(Exception error){return missing();}
    }
    private static WebResourceResponse missing(){return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
}
