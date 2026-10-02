package app.murmur.mobile;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

final class NativeSecrets {
 private static final java.util.Map<String,String> session=new java.util.concurrent.ConcurrentHashMap<>();
 static boolean setSession(String slot,String value){if(!valid(slot)||value==null||value.length()>8192)return false;session.put(slot,value);return true;}
 private static final String ALIAS="murmur_provider_keys";
 private static synchronized SecretKey key() throws Exception {
  KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
  if(store.containsAlias(ALIAS))return (SecretKey)store.getKey(ALIAS,null);
  KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
  generator.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
  return generator.generateKey();
 }
 static boolean write(Context context,String slot,String value){
  if(!valid(slot)||value==null||value.length()>8192)return false;
  try{android.content.SharedPreferences prefs=context.getSharedPreferences("murmur_secrets",Context.MODE_PRIVATE);
   if(value.isEmpty())return prefs.edit().remove(slot).commit();
   Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());
   String encrypted=Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(cipher.doFinal(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)),Base64.NO_WRAP);
   return prefs.edit().putString(slot,encrypted).commit();
  }catch(Exception error){return false;}
 }
 static String read(Context context,String slot){
  if(!valid(slot))return "";
  if(session.containsKey(slot))return session.get(slot);
  try{String data=context.getSharedPreferences("murmur_secrets",Context.MODE_PRIVATE).getString(slot,"");if(data.isEmpty())return "";
   String[] parts=data.split(":",2);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)));
   return new String(cipher.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),java.nio.charset.StandardCharsets.UTF_8);
  }catch(Exception error){return "";}
 }
 private static boolean valid(String slot){return "speech".equals(slot)||"editing".equals(slot)||"sync".equals(slot);}
}
