# Mobile model trials

Murmur 0.8.0-test keeps Parakeet as the default and adds two experimental Nemotron speech recognizers plus optional Piper readback. All model downloads happen inside onboarding or **Models & providers**, with pinned revisions, SHA-256 verification, progress, cancellation and resume. No model weights are bundled in the APK.

## Suitability

| Project | What it does | Android integration | Download | Guidance |
| --- | --- | --- | --- | --- |
| Parakeet TDT v3 INT8 | Speech to text | Existing Sherpa-ONNX CPU runtime, speech segments processed while recording | 670 MB | Default; keeps the previously tested accent support |
| Nemotron 3.5 ASR Streaming Q8_0 | Multilingual speech to text | Official NeMo-Speech.cpp CPU runtime, streaming cache and 1.12-second chunks | 742 MB | Experimental; start with 8 GB RAM and 1.5 GB free storage for one speech model |
| Nemotron Speech Streaming English Q8_0 | English speech to text | Same native runtime and streaming pipeline | 700 MB | Experimental; same starting recommendation |
| Piper Alba medium | English text to speech | Sherpa-ONNX VITS/Piper CPU inference, two threads | 64 MB including English phonemizer | Optional History readback; 4 GB RAM is a reasonable starting recommendation |
| Pipecat | Voice-agent framework connecting ASR, LLM, TTS and transports | No offline model/runtime added; Android clients connect to a backend | Not applicable | Useful if adding a conversational assistant/server later |

These recommendations are **not certified minimums**. The Nemotron publishers do not provide minimum Android RAM/processor requirements or Android timing results. Their desktop/GPU throughput figures cannot establish phone latency. The 600M Nemotron models are comparable in parameter count to Parakeet, not inherently lightweight because they stream.

Android 8+ / API 26 and ARM64 are the APK installation requirements. Many 2021–2026 phones meet them, including older flagships; 32-bit phones do not. A 4–6 GB phone is eligible to try a speech model, but memory pressure, sustained CPU load and thermal limits may make it slow or unreliable. Android 13+ improves text insertion. Snapdragon 8-series, Dimensity 8000/9000-series and comparable chips are sensible candidates. Age alone cannot guarantee that every phone from the past five years runs these models smoothly. A Galaxy S25 Ultra is a strong candidate, but it has not been benchmarked by this build environment.

Use Smart cleanup initially, then test Qwen3 writing separately: writing adds a 977 MB download and additional memory/latency. The recommendation with writing remains 12 GB RAM and 3 GB free storage. Installing all three ASR models, Qwen3 and Piper takes approximately 3.15 GB for model files alone; leave at least 4 GB plus room for recordings. Only one speech recognizer is loaded at a time, and it is released after a session.

## Languages and variants

The linked multilingual model exposes **32 ready locale prompts across 28 languages**, including English, Arabic, Hindi, Japanese, Korean, Chinese and Vietnamese. Four additional locale choices appear in Murmur: UK English, US Spanish, Canadian French and Portuguese from Portugal. Generic language choices map to explicit native locale prompts; Detect language uses the model's automatic prompt. The eight adaptation-ready locales in NVIDIA's card need additional fine-tuning and are not offered as ready support here. Parakeet retains its 25 European languages. The English Nemotron model is [nvidia/nemotron-speech-streaming-en-0.6b](https://huggingface.co/nvidia/nemotron-speech-streaming-en-0.6b), rather than a presumed `nemotron-3.5-...-en` repository.

Piper Alba is British English output. It does not improve speech recognition or rewriting, and does not add multilingual readback. Download it in Models, enable readback, then use **Read aloud** in History. Playback stops when you start the microphone, leave the app, press Stop, or lose audio focus. Long transcripts are read in bounded chunks so they do not require one large generated audio buffer.

## Test on your phone

1. Download the models you want to compare inside Models & providers.
2. Record one representative clip. Include your usual accent, short pauses and any names or numbers. Its audio remains saved in History.
3. Open **Compare models with a saved recording** in Models. Pick the recording and downloaded models. Choose a supported language in Dictate first.
4. Optionally enter the exact words you said, independently of any model's transcript. Run the comparison.
5. Compare text, total time and time divided by audio duration. Values below 1× mean the saved clip was processed faster than its duration. Each run unloads the previous speech model and includes model creation/loading; the operating system's file cache is not flushed. Rewriting is disabled for this test, and the original History entry/audio are not overwritten.
6. Export results if you want to keep or share them. The JSON includes device/RAM information, model, language, duration, time, raw output and an optional reference/word error rate. Export is explicit and uses Android's share sheet; nothing is automatically uploaded.

The comparison screen stays awake only while running. Cancel or leaving the app stops the test and releases that screen flag. Saved audio remains available. Normal dictation streams processing while you talk, so its wait after pressing Finish is a different measurement from whole-recording comparison time. Word error rate ignores punctuation/case and is most appropriate for languages separated by spaces; it can exceed 100% when a model inserts many words.

## Validation and limits

- Both Q8 GGUF files were downloaded from the pinned NVIDIA revisions and their full SHA-256 checksums verified.
- The official runtime and Murmur JNI bridge cross-compiled for Android ARM64, API 26, with 16 KB page alignment and no mandatory GPU or modern CPU-extension dependency.
- Real Linux CPU integration tests exercised the **same Java/JNI/C API streaming bridge** on an 11-second public JFK speech fixture. Both recognized the expected “fellow Americans” and “country” phrases and retained the complete streaming transcript. One run took about 11.3 seconds for multilingual automatic-language mode and 3.9 seconds for English, including model creation. These are shared-cloud x86 host observations, not Android or S25 Ultra benchmarks, and the model files were already in the OS cache.
- Separate CLI smoke tests observed approximately 940 MiB peak process RSS with the quantized models. That is process memory on Linux, not total phone RAM or a certified Android minimum. CLI timings varied under concurrent build load and are not used as phone recommendations.
- The minimal Piper English package generated 3.44 seconds of non-silent, 22,050 Hz speech in a real Sherpa-ONNX CPU test; host loading took 1.30 seconds and generation 0.26 seconds. These are also host observations.
- Unit tests cover catalog integrity, preference migration, language prompts, word-error calculation, safe nested downloads, deletion, retained recordings and bounded Unicode readback. Android tests/build/lint and UI interaction tests verify integration separately.

These tests do not establish accent accuracy on your recordings, real-time processing on older phones, battery impact, or speaker playback on a physical Android device. Use the in-app comparison before changing your default model. Phone coverage should include the S25 Ultra, an 8 GB 2021 flagship and a 4–6 GB older midrange device; test 10-, 60- and 180-second clips both cool and after repeated runs.

For an optional developer host JNI test, build the pinned NeMo-Speech.cpp SDK with `nemo_speech_asr_c` and run:

```sh
node scripts/test-nemotron-native.mjs /path/to/NeMo-Speech.cpp /path/to/host-sdk/bin /path/to/model-folder /path/to/mono-pcm16.pcm 16000 auto 'expected phrase'
```

`JAVA_HOME` must point to a JDK. The model folder must contain `model.gguf`; this optional Linux test requires g++ and uses real weights/audio. End users use in-app downloads, not this developer procedure.

## Piper and Pipecat sources

[rhasspy/piper](https://github.com/rhasspy/piper) now redirects its README to [OHF-Voice/piper1-gpl](https://github.com/OHF-Voice/piper1-gpl). This app uses Sherpa-ONNX's Piper/VITS support and eSpeak NG; GPL attribution/source obligations apply to the phonemizer. See [model/runtime notices](../MODEL-NOTICES.md).

[Pipecat](https://github.com/pipecat-ai/pipecat) is a Python backend framework under the BSD 2-Clause licence; its Android/React Native clients connect to a backend. It does not itself supply mobile ASR weights or make a Python voice pipeline run offline on Android. It is relevant to a future conversational/duplex assistant, but adding it would not accelerate current offline dictation. Murmur's custom transcription endpoint can be used with a separately implemented compatible server; no Pipecat integration is claimed in this APK.

Primary sources: [multilingual Nemotron card](https://huggingface.co/nvidia/nemotron-3.5-asr-streaming-0.6b), [English Nemotron card](https://huggingface.co/nvidia/nemotron-speech-streaming-en-0.6b), [NeMo-Speech.cpp](https://github.com/NVIDIA/NeMo-Speech.cpp), [Piper Alba model card](https://huggingface.co/csukuangfj/vits-piper-en_GB-alba-medium/blob/7e469a54c7a4f5bd191cae788e197266e2c9c5ac/MODEL_CARD), [Sherpa-ONNX TTS documentation](https://k2-fsa.github.io/sherpa/onnx/tts/index.html).
