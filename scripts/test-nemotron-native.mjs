import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Optional Linux integration test. Uses real weights/audio; no Android device simulation.
const [sdkSource, sdkLibraries, modelDirectory, pcmFile, sampleRate='16000', language='auto', ...expectedPhrases]=process.argv.slice(2);
if(!sdkSource||!sdkLibraries||!modelDirectory||!pcmFile||!process.env.JAVA_HOME)throw new Error('Usage: JAVA_HOME=<JDK> node scripts/test-nemotron-native.mjs <NeMo source> <host SDK bin> <model folder containing model.gguf> <PCM16 mono file> [rate] [language] [expected phrases...]');
if(process.platform!=='linux')throw new Error('This optional host test currently supports Linux.');
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const build=mkdtempSync(path.join(tmpdir(),'murmur-native-test-'));
const jdk=process.env.JAVA_HOME;
function run(command,args){const result=spawnSync(command,args,{stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)throw new Error(`${path.basename(command)} exited with ${result.status}.`);}
run('g++',['-std=c++17','-O2','-fPIC','-shared',path.join(project,'android/app/src/main/cpp/nemotron-jni.cpp'),
  `-I${path.join(jdk,'include')}`,`-I${path.join(jdk,'include/linux')}`,`-I${path.join(sdkSource,'include')}`,
  `-L${path.resolve(sdkLibraries)}`,'-lnemo_speech_asr_c',`-Wl,-rpath,${path.resolve(sdkLibraries)}`,'-o',path.join(build,'libmurmur_nemotron.so')]);
const java=path.join(project,'android/app/src/main/java/app/murmur/mobile');
run(path.join(jdk,'bin/javac'),['-d',build,path.join(project,'tests/native/NemotronSmoke.java'),path.join(java,'NemotronRecognizer.java'),path.join(java,'SpeechLanguage.java')]);
run(path.join(jdk,'bin/java'),[`-Djava.library.path=${build}`,'-cp',build,'app.murmur.mobile.NemotronSmoke',path.resolve(modelDirectory),path.resolve(pcmFile),sampleRate,language,...expectedPhrases]);
