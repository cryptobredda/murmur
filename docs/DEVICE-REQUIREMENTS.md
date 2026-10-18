# Local model device guidance

The APK installation minimum is Android 8 / API 26 and ARM64. This does not establish that every compatible phone runs the local models smoothly.

| Configuration | Recommended advertised RAM | Free storage before download |
| --- | --- | --- |
| Parakeet or experimental Nemotron + Smart cleanup | 8 GB | 1.5 GB |
| One speech model + Qwen3 writing | 12 GB | 3 GB |

For Piper readback alone, start with 4 GB RAM and 150 MB free storage. This is a practical recommendation, not a certified minimum.

Prefer Android 13+ and Snapdragon 8-series, Dimensity 8000/9000-series or comparable processors. Android 13 improves insertion into modern editors through its accessibility input connection. Murmur's assessment allows for RAM reserved by Android.

These are practical recommendations, not vendor-certified minimums or guaranteed processing times. Recording length, heat, memory pressure, and writing can increase latency. Saved audio needs additional storage. The Galaxy S25 Ultra belongs to the intended class of recent flagship phones; other devices need testing.

Many phones released in the past five years meet the installation requirements, but a 4–6 GB older midrange phone may process the 600M ASR models slowly or experience memory pressure. The experimental models do not require a GPU. Use the saved-recording comparison to check suitability on the actual device. Installing all offered models requires about 3.15 GB in model files; leave at least 4 GB plus recording space. [Detailed model review and test procedure](MOBILE-MODELS.md).

## Sources

- [NVIDIA Parakeet model card](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3): languages, architecture, original-model guidance. Original Linux loading memory is not a phone RAM minimum.
- [Sherpa-ONNX Android runtime](https://k2-fsa.github.io/sherpa/onnx/android/apk.html).
- [Pinned Qwen3 LiteRT model card](https://huggingface.co/litert-community/Qwen3-1.7B/blob/73fbc3fe8271c162a603ee66f6e7ed25b6211195/README.md): conversion and Galaxy S26 measurements, not universal phone requirements or an S25 Ultra benchmark.
- [Android accessibility input connection](https://developer.android.com/reference/android/accessibilityservice/AccessibilityService#getInputMethod()).

See [MODEL-NOTICES.md](../MODEL-NOTICES.md) for exact conversions/licences. Cloud providers are optional alternatives for slower phones or languages outside the local model's supported set.
