# Local model attribution

Murmur offers separately downloaded models. This APK bundles inference runtimes, not the model weights. Murmur modifies the execution and editing pipeline; it is not endorsed by the model publishers.

## NVIDIA Parakeet TDT 0.6B v3

Creator: NVIDIA. Source: https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3

Model license: Creative Commons Attribution 4.0 International, https://creativecommons.org/licenses/by/4.0/

The in-app download uses the INT8 ONNX conversion published by csukuangfj: https://huggingface.co/csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8 at revision `2bda32ec70b097a55adaa07d9a7173915b43cc78`. This conversion changes the weight format and quantization. Murmur does not fine-tune these weights. The file manifest records pinned SHA-256 checksums. Sherpa-ONNX is Apache-2.0: https://github.com/k2-fsa/sherpa-onnx

## Qwen3 1.7B

Creator: Qwen team, Alibaba Cloud. Source and Apache-2.0 license: https://huggingface.co/Qwen/Qwen3-1.7B

The in-app download uses Google's LiteRT community INT4 conversion: https://huggingface.co/litert-community/Qwen3-1.7B at revision `73fbc3fe8271c162a603ee66f6e7ed25b6211195`. This conversion changes the weight format and quantization. Murmur does not fine-tune these weights. LiteRT-LM is Apache-2.0: https://github.com/google-ai-edge/LiteRT-LM

Bundled runtimes, libraries, and fonts retain their original licenses as listed in README.md and their upstream repositories.
