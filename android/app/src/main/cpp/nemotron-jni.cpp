#include <jni.h>
#include <memory>
#include <new>
#include <exception>
#include <string>
#include <vector>
#include "nemo_speech/asr.h"

namespace {
#define JNI_CATCH(fallback) \
    catch (const std::bad_alloc&) { env->ThrowNew(env->FindClass("java/lang/OutOfMemoryError"), "Not enough memory for local speech. Your recording is saved."); return fallback; } \
    catch (const std::exception& error) { env->ThrowNew(env->FindClass("java/io/IOException"), error.what()); return fallback; }
void check(JNIEnv* env, nemo_speech_asr_status status) {
    if (status == NEMO_SPEECH_ASR_OK) return;
    const char* message = nemo_speech_asr_last_error();
    env->ThrowNew(env->FindClass("java/io/IOException"), message ? message : "Local speech recognition failed.");
}
std::string utf8(JNIEnv* env, jstring value) {
    const char* chars = env->GetStringUTFChars(value, nullptr);
    if (!chars) return {};
    std::string result(chars);
    env->ReleaseStringUTFChars(value, chars);
    return result;
}
jstring javaString(JNIEnv* env, const std::string& text) {
    jbyteArray bytes = env->NewByteArray(static_cast<jsize>(text.size()));
    if (!bytes) return nullptr;
    env->SetByteArrayRegion(bytes, 0, static_cast<jsize>(text.size()), reinterpret_cast<const jbyte*>(text.data()));
    if (env->ExceptionCheck()) return nullptr;
    jclass stringClass = env->FindClass("java/lang/String");
    jmethodID constructor = env->GetMethodID(stringClass, "<init>", "([BLjava/lang/String;)V");
    jstring encoding = env->NewStringUTF("UTF-8");
    return static_cast<jstring>(env->NewObject(stringClass, constructor, bytes, encoding));
}
struct Stream {
    nemo_speech_asr_stream* native = nullptr;
    std::string text;
    ~Stream() { if (native) nemo_speech_asr_stream_close(native); }
    void drain(JNIEnv* env) {
        while (!env->ExceptionCheck()) {
            nemo_speech_asr_result* result = nullptr;
            check(env, nemo_speech_asr_stream_next(native, &result));
            if (!result) break;
            const std::unique_ptr<nemo_speech_asr_result, decltype(&nemo_speech_asr_result_destroy)> owned(result, nemo_speech_asr_result_destroy);
            const char* transcript = nemo_speech_asr_result_transcript(result, 0);
            if (transcript && *transcript) text = transcript;
        }
    }
};
}

extern "C" JNIEXPORT jlong JNICALL
Java_app_murmur_mobile_NemotronRecognizer_create(JNIEnv* env, jclass, jstring path) try {
    const std::string modelPath = utf8(env, path);
    if (env->ExceptionCheck()) return 0;
    nemo_speech_asr_backend_config backend{};
    backend.size = sizeof(backend); backend.gpu = -1;
    nemo_speech_asr_model_config model{};
    model.size = sizeof(model); model.path = modelPath.c_str();
    nemo_speech_asr_streaming_config streaming{};
    streaming.size = sizeof(streaming);
    streaming.chunk_size = 0.16f; streaming.ctc_left_padding = 1.92f; streaming.ctc_right_padding = 1.92f;
    streaming.rnnt_right_context = 13; // 1.12 s chunks: accuracy and efficient CPU batches.
    nemo_speech_asr_recognizer_config config{};
    config.size = sizeof(config); config.backend = &backend; config.model = &model; config.streaming = &streaming;
    nemo_speech_asr_recognizer* recognizer = nullptr;
    check(env, nemo_speech_asr_create(&config, &recognizer));
    return reinterpret_cast<jlong>(recognizer);
} JNI_CATCH(0)
extern "C" JNIEXPORT jlong JNICALL
Java_app_murmur_mobile_NemotronRecognizer_start(JNIEnv* env, jclass, jlong handle, jstring language) try {
    if (!handle) { env->ThrowNew(env->FindClass("java/io/IOException"), "Speech model is not loaded."); return 0; }
    const std::string locale = utf8(env, language);
    if (env->ExceptionCheck()) return 0;
    auto stream = std::make_unique<Stream>();
    auto options = nemo_speech_asr_recognition_options_default();
    options.language_code = locale.c_str(); options.interim_results = true;
    options.enable_automatic_punctuation = true;
    check(env, nemo_speech_asr_streaming_recognize(reinterpret_cast<nemo_speech_asr_recognizer*>(handle), &options, &stream->native));
    if (env->ExceptionCheck()) return 0;
    return reinterpret_cast<jlong>(stream.release());
} JNI_CATCH(0)
extern "C" JNIEXPORT void JNICALL
Java_app_murmur_mobile_NemotronRecognizer_push(JNIEnv* env, jclass, jlong handle, jfloatArray samples, jint rate) try {
    auto* stream = reinterpret_cast<Stream*>(handle);
    if (!stream) return;
    const jsize count = env->GetArrayLength(samples);
    std::vector<float> audio(static_cast<size_t>(count));
    env->GetFloatArrayRegion(samples, 0, count, audio.data());
    if (env->ExceptionCheck()) return;
    check(env, nemo_speech_asr_stream_push_f32(stream->native, audio.data(), audio.size(), rate));
    if (!env->ExceptionCheck()) stream->drain(env);
} JNI_CATCH()
extern "C" JNIEXPORT jstring JNICALL
Java_app_murmur_mobile_NemotronRecognizer_finish(JNIEnv* env, jclass, jlong handle) try {
    auto* stream = reinterpret_cast<Stream*>(handle);
    if (!stream) return nullptr;
    check(env, nemo_speech_asr_stream_finish(stream->native));
    if (!env->ExceptionCheck()) stream->drain(env);
    return env->ExceptionCheck() ? nullptr : javaString(env, stream->text);
} JNI_CATCH(nullptr)
extern "C" JNIEXPORT void JNICALL
Java_app_murmur_mobile_NemotronRecognizer_closeStream(JNIEnv*, jclass, jlong handle) { delete reinterpret_cast<Stream*>(handle); }
extern "C" JNIEXPORT void JNICALL
Java_app_murmur_mobile_NemotronRecognizer_destroy(JNIEnv*, jclass, jlong handle) {
    if (handle) nemo_speech_asr_destroy(reinterpret_cast<nemo_speech_asr_recognizer*>(handle));
}
