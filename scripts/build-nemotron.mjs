import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Build-time dependencies only. Model weights are downloaded by the Android app.
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [sdk, output] = process.argv.slice(2).map(value => path.resolve(value));
if (!sdk || !output) throw new Error('Expected Android SDK directory and build output directory.');
const ndk = path.join(sdk, 'ndk', '28.2.13676358');
const cmakeBin = path.join(sdk, 'cmake', '3.31.6', 'bin');
const cmake = path.join(cmakeBin, process.platform === 'win32' ? 'cmake.exe' : 'cmake');
const ninja = path.join(cmakeBin, process.platform === 'win32' ? 'ninja.exe' : 'ninja');
if (!existsSync(cmake) || !existsSync(ndk)) throw new Error('Install Android NDK 28.2.13676358 and CMake 3.31.6 in your SDK.');
const sources = path.join(output, 'sources');
mkdirSync(sources, { recursive: true });
function run(command, args, cwd = project) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(command)} failed (${result.status}).`);
}
function checkout(name, url, revision, destination = path.join(sources, name)) {
  if (!existsSync(path.join(destination, '.git'))) {
    mkdirSync(destination, { recursive: true });
    run('git', ['init', '-q', destination]);
    run('git', ['-C', destination, 'remote', 'add', 'origin', url]);
  }
  const head = spawnSync('git', ['-C', destination, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  if (head.status !== 0 || head.stdout.trim() !== revision) {
    run('git', ['-c', 'credential.helper=', '-C', destination, 'fetch', '--depth=1', 'origin', revision]);
    run('git', ['-C', destination, 'checkout', '--detach', revision]);
  }
  return destination;
}
const nemo = checkout('nemo', 'https://github.com/NVIDIA/NeMo-Speech.cpp.git', 'b809bbb467fb2da2be0042fff5ef1f503828c9cf');
checkout('llama', 'https://github.com/ggml-org/llama.cpp.git', 'bd4f514db14d87fded667787a7a963bfbaa98e89', path.join(nemo, 'llama.cpp'));
const sp = checkout('sentencepiece', 'https://github.com/google/sentencepiece.git', '17d7580d6407802f85855d2cc9190634e2c95624');
const toolchain = [
  '-G', 'Ninja', `-DCMAKE_MAKE_PROGRAM=${ninja}`,
  `-DCMAKE_TOOLCHAIN_FILE=${path.join(ndk, 'build/cmake/android.toolchain.cmake')}`,
  '-DANDROID_ABI=arm64-v8a', '-DANDROID_PLATFORM=android-26', '-DANDROID_STL=c++_shared',
  '-DCMAKE_BUILD_TYPE=Release', '-DCMAKE_POSITION_INDEPENDENT_CODE=ON',
];
const spBuild = path.join(output, 'sentencepiece');
run(cmake, ['-S', sp, '-B', spBuild, ...toolchain, '-DSPM_ENABLE_SHARED=OFF', '-DSPM_BUILD_TEST=OFF', '-DSPM_ENABLE_TCMALLOC=OFF', '-DSPM_ENABLE_NFKC_COMPILE=OFF']);
run(cmake, ['--build', spBuild, '--target', 'sentencepiece-static', '--parallel', '4']);
const upstreamCmake = path.join(nemo, 'CMakeLists.txt');
const marker = '\n# Murmur Android integration\ninclude("${MURMUR_ANDROID_CMAKE}")\n';
if (!readFileSync(upstreamCmake, 'utf8').includes('# Murmur Android integration')) writeFileSync(upstreamCmake, readFileSync(upstreamCmake, 'utf8') + marker);
const sdkBuild = path.join(output, 'sdk');
run(cmake, ['-S', nemo, '-B', sdkBuild, ...toolchain,
  '-DGGML_NATIVE=OFF', '-DGGML_OPENMP=OFF', '-DGGML_CUDA=OFF', '-DGGML_VULKAN=OFF', '-DGGML_METAL=OFF',
  '-DNEMO_SPEECH_BUILD_ASR=ON', '-DNEMO_SPEECH_BUILD_DIAR=OFF', '-DNEMO_SPEECH_BUILD_TTS=OFF',
  '-DNEMO_SPEECH_BUILD_CLI=OFF', '-DNEMO_SPEECH_BUILD_MIC_CAPTURE=OFF', '-DNEMO_SPEECH_BUILD_TESTS=OFF',
  '-DNEMO_SPEECH_BUILD_EXAMPLES=OFF', '-DNEMO_SPEECH_BUILD_HTTP=OFF', '-DNEMO_SPEECH_BUILD_GRPC=OFF',
  `-DSENTENCEPIECE_STATIC_LIB=${path.join(spBuild, 'src/libsentencepiece.a')}`,
  `-DSENTENCEPIECE_INCLUDE_DIR=${path.join(sp, 'src')}`,
  `-DMURMUR_ANDROID_CMAKE=${path.join(project, 'android/app/src/main/cpp/nemo-android.cmake')}`,
]);
run(cmake, ['--build', sdkBuild, '--target', 'murmur_nemotron', '--parallel', '4']);
const libraries = path.join(output, 'jniLibs', 'arm64-v8a');
mkdirSync(libraries, { recursive: true });
for (const name of readdirSync(path.join(sdkBuild, 'bin')).filter(name => name.endsWith('.so'))) cpSync(path.join(sdkBuild, 'bin', name), path.join(libraries, name));
const host = readdirSync(path.join(ndk, 'toolchains/llvm/prebuilt'))[0];
cpSync(path.join(ndk, 'toolchains/llvm/prebuilt', host, 'sysroot/usr/lib/aarch64-linux-android/libc++_shared.so'), path.join(libraries, 'libc++_shared.so'));
const licenses = path.join(output, 'assets', 'licenses', 'nemotron');
mkdirSync(licenses, { recursive: true });
for (const name of ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md']) cpSync(path.join(nemo, name), path.join(licenses, name));
cpSync(path.join(sp, 'LICENSE'), path.join(licenses, 'SENTENCEPIECE-LICENSE'));
cpSync(path.join(nemo, 'llama.cpp/LICENSE'), path.join(licenses, 'LLAMA-GGML-LICENSE'));
cpSync(path.join(project, 'MODEL-NOTICES.md'), path.join(output, 'assets/licenses/MODEL-NOTICES.md'));
cpSync(path.join(project, 'LICENSE'), path.join(output, 'assets/licenses/MURMUR-LICENSE'));
console.log('Nemotron Android libraries and attribution prepared. No model weights bundled.');
