# Model integration review — 4 October 2026

Murmur 0.8.0-test adds experimental Nemotron multilingual/English recognition, optional Piper Alba readback and a saved-recording comparison tool. Parakeet remains the default. Models download and verify inside the app; the original recordings/history are preserved during comparison.

## Verified

| Check | Result |
| --- | --- |
| JavaScript behavior tests | 36 passed |
| TypeScript and production build | Passed |
| Android unit tests | 19 passed |
| Android lint | 0 errors, 20 warnings |
| Android ARM64 native SDK and JNI compilation | Passed; API 26 baseline, 16 KB-aligned new libraries |
| Debug APK assembly/signature verification | Passed; version code 8, same certificate as previous 0.7 test build |
| Real Nemotron JNI transcription | Both official Q8 models recognized the expected words in the public 11-second JFK clip |
| Piper real CPU synthesis | English-only download package generated non-silent 22,050 Hz speech |
| Production UI interaction checks | Download, persisted selection, compare/export, cancel/wake release, optional voice and readback passed with fictional bridge data |
| Public source credential scan | No findings in the publishable source snapshot |

Lint warnings are retained in the build report; this check is not a clean-warning certification. Native recognition/synthesis tests ran on a Linux CPU host, not an Android handset. The UI bridge simulation tests behavior and does not measure native performance. See [mobile model review](MOBILE-MODELS.md) for the measurements and test limits.

## Phone testing still needed

Use the in-app comparison on an S25 Ultra, an 8 GB 2021 flagship, and a 4–6 GB older midrange phone. Include usual accent, names/numbers and long pauses; compare 10-, 60- and 180-second recordings. Check hot/repeated runs, memory pressure, background streaming, cancellation, Piper speaker playback and audio focus. Enter an independently written exact reference to measure word errors.

These results do not establish universal minimum phone specs, accent accuracy or a guaranteed 5–10-second completion time. Pipecat is documented as a backend framework and is not bundled. APK third-party licences/source references are included; eSpeak NG's GPL-3.0 obligations remain applicable.
