# Parakeet Ultra tester update — 0.10.0

This source update is for the existing Google Play testing app. **Zyralabs** remains the developer; **info@zyralabs.xyz** remains the support/privacy contact. The publishing agent owns signing and submission to the existing testing track. No production release or Play upload is performed here.

## Source and version

Use branch **`feature/parakeet-ultra`**. It starts from `release/british-english-store` at `0d233ab5492ead4df69187585595606896befd83`, which already contains the 0.9 Android/API 36, British English, Accessibility consent and store-preparation changes. Public `main` was still 0.7 when this update began. Build this complete branch; copying only the model manifest onto `main` omits the native routing and upgrade flow.

The source application ID remains **`app.murmur.mobile`**, target API **36**, ARM64 only. Source version: **0.10.0**, version code **10**. Before building for Play, inspect the highest version code already uploaded in Play Console, including inactive/draft/testing artifacts, and increase the source value if 10 is already used. The public GitHub repository does not establish the version code currently installed by every tester. Use the existing Play signing/upload setup; do not create a replacement application ID or signing identity.

## What testers get

Ultra is the recommended default for a new installation. On upgrade, a valid saved model selection is retained, including original Parakeet and any explicitly selected cloud/experimental configuration. Onboarding, language, English spelling, recognition mode, provider settings, history, audio, vocabulary and snippets are not reset. No database migration or data-clearing step is introduced.

Existing testers open **Models → Parakeet Ultra → Download and use**. This downloads **670,576,838 bytes** inside the app, verifies each file and loads the model before saving the new selection. Until that succeeds, the previous selection stays in place. Cancellation or a failed download/preparation does not replace it. Loading a different downloaded model through its radio control also waits for successful preparation before switching.

Ultra uses its own `speech-models/parakeet-ultra` directory and verification marker. Original Parakeet's `speech-models/parakeet-v3` files are never relabelled, mixed with Ultra or deleted by this upgrade. Keeping both takes about **671 MB additional storage**. The original remains available for comparison and switching back; removing a downloaded model remains a separate explicit action.

Speech still runs locally on CPU through Sherpa-ONNX **1.13.8**, including the existing personal-vocabulary search and same-audio fallback. The floating/background flow, saved-recording recovery and optional writing model remain in place. This update adds no permission, account, server or subscription.

## Exact model and limits

- Source: [Moondream Parakeet Ultra](https://huggingface.co/moondream/parakeet-ultra), revision `73175eb7aeb0d82f1e2a6b53b3aabc10a90bcd0b`.
- INT8 conversion: [tpmaerk/parakeet-ultra-sherpa-onnx-int8](https://huggingface.co/tpmaerk/parakeet-ultra-sherpa-onnx-int8), revision `b86784a3a5356cbd126f710b61cd90c5fe5898f1`.
- The catalog pins file names, byte counts, SHA-256 hashes and immutable download URLs. Its tokenizer is byte-identical to Murmur's pinned original tokenizer; both models reuse the attributed BPE vocabulary.
- CC BY 4.0 attribution to Moondream, NVIDIA and the converter appears in the model notices and app credits. The converter omits Ultra's six extra VAD tensors; Murmur retains its existing segmentation. [MODEL-NOTICES.md](../MODEL-NOTICES.md).
- The practical recommendation remains 8 GB RAM for speech/Smart cleanup, or 12 GB with local AI writing. Keeping both models needs extra storage. These are recommendations, not certified minimums or measured S25 performance.
- Publisher full-precision GPU accuracy/speed results are not Android INT8 benchmark results. Do not advertise a measured British-accent gain or phone latency from the small host smoke check. Recognition and rewriting remain separate; compare raw speech output before judging rewriting.

## Validation and repeatable checks

The implementation includes unit tests for the model catalog/defaults, preserved upgrade preferences, both Parakeet native routes and retained model/audio directories. Browser checks exercise cancellation, failed downloads, successful selection, restart persistence, switching back to the original, saved-history preservation and comparison/export. Those browser checks use fictional native-bridge data.

The real pinned Ultra files have been SHA-256 verified and exercised on Linux CPU using Sherpa-ONNX 1.13.8, in greedy and dictionary-guided modes. Both recover the reference words of the public 11-second JFK sample. This checks integration and export compatibility, not representative accent accuracy or physical Android performance.

Run normal checks:

```sh
npm ci --ignore-scripts
npm test
npm run build
CHROME_EXECUTABLE=/usr/bin/chromium npm run test:ui
npm run store:check
node scripts/android-assets.mjs
cd android
./gradlew testDebugUnitTest lintDebug lintRelease bundleRelease
```

The GitHub workflow runs the JavaScript/store/build checks plus all native Java unit tests, both lint variants, a debug APK and the unsigned review bundle in a clean environment. Browser tests and real-model checks are additional developer checks. No production signing key is present in the repository.

For a developer-only real-model smoke check, install `sherpa-onnx==1.13.8`, `numpy`, and `soundfile` in a Python 3.11+ environment, put the pinned four-file bundle in a scratch directory, and provide mono audio. End users use the in-app downloader.

```sh
python scripts/check-parakeet-ultra.py \
  --model-dir /path/to/pinned-ultra-bundle --audio /path/to/jfk.wav \
  --hint Americans \
  --reference 'And so my fellow Americans ask not what your country can do for you ask what you can do for your country'
```

Public sample: [whisper.cpp samples/jfk.wav](https://github.com/ggml-org/whisper.cpp/blob/master/samples/jfk.wav). The script verifies the catalog hashes before loading the models. Keep personal recordings outside Git.

## Publishing-agent handoff

1. Confirm this branch matches the source used for the existing Play testing app. If the Play build has additional unpublished changes, preserve/rebase them before building. Confirm the application ID, highest Play version code and existing signing setup.
2. Run the checks above. Configure the existing upload key through protected environment variables as described in [SIGNING.md](../store/SIGNING.md), then build/sign `app-release.aab`. Without those variables the review bundle is unsigned and cannot be submitted as a signed release.
3. Upgrade a current tester installation through the existing Play track. Keep its app data. Confirm that its current model and old history/audio survive, then exercise Models → Ultra → Download and use, cancellation, failed/resumed download and switching back.
4. On a physical S25 Ultra, test normal British speech, difficult names/terms, pauses, long dictations, dictionary-guided recognition, offline operation, the cross-app floating control, insertion/clipboard, cancellation and saved-audio retry. Compare Ultra and original Parakeet on the same recording; review raw recognition separately from writing.
5. Use `store/google-play/metadata/en-GB/release_notes.txt` for tester notes. Existing listing pictures still show supported features/original model choices. Regenerate pictures with `npm run store:assets` if desired. Preserve the working public privacy URL and Console declarations already used by the Play app; after merging source, update source-linked policy/licence URLs as appropriate.
6. Submit to the existing **testing** track and follow its review/rollout process. Production publication and the iOS app remain outside this change.
