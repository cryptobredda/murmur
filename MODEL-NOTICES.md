# Local model attribution

Murmur offers separately downloaded models. This APK bundles inference runtimes, not the model weights. Murmur modifies the execution and editing pipeline; it is not endorsed by the model publishers.

## NVIDIA Parakeet TDT 0.6B v3

Creator: NVIDIA. Source: https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3

Model license: Creative Commons Attribution 4.0 International, https://creativecommons.org/licenses/by/4.0/

The in-app download uses the INT8 ONNX conversion published by csukuangfj: https://huggingface.co/csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8 at revision `2bda32ec70b097a55adaa07d9a7173915b43cc78`. This conversion changes the weight format and quantization. Murmur does not fine-tune these weights. The file manifest records pinned SHA-256 checksums. Sherpa-ONNX is Apache-2.0: https://github.com/k2-fsa/sherpa-onnx

## Qwen3 1.7B

Creator: Qwen team, Alibaba Cloud. Source and Apache-2.0 license: https://huggingface.co/Qwen/Qwen3-1.7B

The in-app download uses Google's LiteRT community INT4 conversion: https://huggingface.co/litert-community/Qwen3-1.7B at revision `73fbc3fe8271c162a603ee66f6e7ed25b6211195`. This conversion changes the weight format and quantization. Murmur does not fine-tune these weights. LiteRT-LM is Apache-2.0: https://github.com/google-ai-edge/LiteRT-LM

## NVIDIA Nemotron 3.5 ASR Streaming 0.6B

Creator and Q8 GGUF conversion: NVIDIA. Source: https://huggingface.co/nvidia/nemotron-3.5-asr-streaming-0.6b

License: Open Model, Data & Weights licence 1.1, https://openmdw.ai/license/1-1/ . The pinned official Q8_0 GGUF is revision `ea30d66debe3740a08b573244286791d423d6b3e`, filename `nemotron-3.5-asr-streaming-0.6b.q8_0.gguf`. Murmur downloads it as `model.gguf` without altering the weights.

## NVIDIA Nemotron Speech Streaming English 0.6B

Creator and Q8 GGUF conversion: NVIDIA. Source: https://huggingface.co/nvidia/nemotron-speech-streaming-en-0.6b

License: NVIDIA Open Model License, https://www.nvidia.com/en-us/agreements/enterprise-software/nvidia-open-model-license/ . This differs from the multilingual model's licence. Revision `ebe59e5a817142986528bbbee5dba8db7b38ed50`, filename `nemotron-speech-streaming-en-0.6b.q8_0.gguf`, downloaded as `model.gguf` without altering the weights.

The native runtime is NVIDIA NeMo-Speech.cpp, Apache-2.0, revision `b809bbb467fb2da2be0042fff5ef1f503828c9cf`: https://github.com/NVIDIA/NeMo-Speech.cpp . The build uses its pinned GGML/llama.cpp dependency, revision `bd4f514db14d87fded667787a7a963bfbaa98e89` (MIT), and SentencePiece v0.2.0, revision `17d7580d6407802f85855d2cc9190634e2c95624` (Apache-2.0). Runtime licences, NOTICE and third-party notices are copied into APK assets during the build. Murmur adds an Android JNI bridge and packaging adjustments; these changes do not modify model weights.

## Piper Alba medium, British English

Voice conversion: https://huggingface.co/csukuangfj/vits-piper-en_GB-alba-medium , revision `7e469a54c7a4f5bd191cae788e197266e2c9c5ac`. The Alba model card credits the University of Edinburgh speech dataset: https://datashare.ed.ac.uk/handle/10283/3270 , CC BY 4.0. The voice was fine-tuned from the US English Lessac medium voice. Its original model card accompanies the download and is included in APK attribution assets. Murmur does not fine-tune the voice.

Piper's original repository moved to https://github.com/OHF-Voice/piper1-gpl . Murmur uses Sherpa-ONNX's VITS/Piper inference, rather than bundling the Piper Python engine. The eSpeak NG phonemizer and its data are GPL-3.0; this is **not** an entirely MIT/Apache runtime. The GPL text is included in `android/app/src/main/assets/licenses/piper/`. Sherpa-ONNX v1.13.8 pins its modified eSpeak NG source to `ed530aa113046142eb5115cf2fc9157854d0ffe1`: https://github.com/csukuangfj/espeak-ng/tree/ed530aa113046142eb5115cf2fc9157854d0ffe1 . Corresponding runtime source/build recipes: https://github.com/k2-fsa/sherpa-onnx/tree/v1.13.8 . Downstream binary distributors must honour the GPL obligations for these components, including corresponding source and licence notices; Murmur's MIT source licence does not override them.

The in-app English-only package includes the ONNX voice, token/config files, model card and required English eSpeak data; it omits unrelated languages. All files are pinned and SHA-256 checked. This changes package selection, not voice weights.

Bundled runtimes, libraries, and fonts retain their original licences as listed in README.md and their upstream repositories. Pipecat is evaluated in the model guide but is not bundled or required by Murmur.
