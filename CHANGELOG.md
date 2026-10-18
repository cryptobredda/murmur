# Changelog

## 0.9.0 — release candidate

- Keep Parakeet as the default; use personal terms during recognition in Accurate mode, with the original decoder when no terms are saved or Fast is selected.
- Preserve more context through short pauses and retry empty wider-search output using the same audio.
- Default English cleanup to British spelling while protecting code, literals and personal terms.
- Learn conservative short phrase corrections and import background corrections without reopening Murmur, acknowledging only successful dictionary writes.
- Add an Accessibility disclosure/consent and publisher/support/privacy links.
- Target Android API 36, update the build tools, migrate predictive back handling and configure optional owner-controlled upload signing.
- Include a Zyralabs store pack: Play copy, privacy/declaration guides, five listing pictures, icons and a feature graphic. iOS branding/copy are drafts; the iOS app is deferred.

Testing APK version: `0.9.0-test`. No production signing credentials or store submission are included. [Accuracy details and validation limits](docs/BRITISH-ENGLISH.md).

## 0.8.0-test — model trials

- Add experimental Nemotron streaming models and optional Piper Alba offline English readback.
- Compare downloaded speech models against the same saved audio; optionally measure against reference text and export results.
- Keep Parakeet selected by default. Experimental models do not establish a general mobile accuracy/speed improvement.

## 0.7.0-test — public review

- Parakeet TDT v3 as the sole local speech model, with verified in-app downloads.
- Optional Qwen3 1.7B writing and default lightweight Smart cleanup.
- Device guidance in onboarding and model settings.
- Compact branded floating control, saved placement, transparency, cancellation, and ten-minute pause.
- Background dictation, automatic insertion, and clipboard fallback with your existing keyboard.
- Saved audio recovery/reprocessing, history, vocabulary/snippets, writing profiles, and optional cloud/sync.
- Public-source packaging, brand imagery, reproducible UI captures, and contributor/privacy/release guides.

This describes the review version, not a production release announcement.
