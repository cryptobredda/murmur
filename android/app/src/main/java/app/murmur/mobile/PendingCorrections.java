package app.murmur.mobile;
import android.content.Context;
import android.content.SharedPreferences;
import org.json.*;
import java.util.*;

/** Acknowledge only after the dictionary write succeeds; no correction is lost on a restart. */
final class PendingCorrections {
    private static SharedPreferences prefs(Context context){return context.getSharedPreferences("murmur_overlay",Context.MODE_PRIVATE);}
    private static JSONArray read(Context context) throws JSONException {
        JSONArray rows=new JSONArray(prefs(context).getString("learned","[]"));boolean migrated=false;
        for(int i=0;i<rows.length();i++){JSONObject row=rows.getJSONObject(i);if(!row.has("id")){row.put("id",UUID.randomUUID().toString());migrated=true;}}
        if(migrated)prefs(context).edit().putString("learned",rows.toString()).apply();return rows;
    }
    static synchronized String peek(Context context){try{return read(context).toString();}catch(JSONException ignored){return "[]";}}
    static synchronized void add(Context context,String spoken,String replacement){
        try{JSONArray rows=read(context);if(rows.length()<100){rows.put(new JSONObject().put("id",UUID.randomUUID().toString()).put("spoken",spoken).put("replacement",replacement));prefs(context).edit().putString("learned",rows.toString()).apply();}}catch(JSONException ignored){}
    }
    static synchronized void acknowledge(Context context,String json){
        try{JSONArray ids=new JSONArray(json);Set<String>done=new HashSet<>();for(int i=0;i<ids.length();i++)done.add(ids.getString(i));JSONArray remaining=new JSONArray(),rows=read(context);for(int i=0;i<rows.length();i++)if(!done.contains(rows.getJSONObject(i).getString("id")))remaining.put(rows.get(i));prefs(context).edit().putString("learned",remaining.toString()).apply();}catch(JSONException ignored){}
    }
    static synchronized void clear(Context context){prefs(context).edit().remove("learned").apply();}
}
