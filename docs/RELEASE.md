# Release readiness

Creating this public repository does not publish an APK release or submit to a store. The maintainer decides when to publish.

## Android release checklist

- Review feature claims, README, privacy guide, and model attribution.
- Run the JavaScript and Android checks in [BUILDING.md](BUILDING.md).
- Test on physical ARM64 phones: downloads, offline recognition, insertion/clipboard fallback, placement/transparency, pause/resume, active-session wakefulness, saved-audio retry, deletion, and export.
- Test cloud/sync using test credentials. Keep personal audio/account screens out of examples.
- Scan tracked source and Git history for credentials, signing keys, private deployment files, and personal data. Verify download checksums.
- Bump Android `versionCode` and stable `versionName`; update [CHANGELOG.md](../CHANGELOG.md).
- Build a production-signed APK/AAB with a maintainer-owned key. Android Studio's **Generate Signed Bundle / APK** flow can create it. Keep the keystore/passwords outside Git in protected storage or CI secrets.
- Test that exact artifact; record its SHA-256/certificate fingerprint and securely retain the signing key for updates.
- After review, publish a GitHub release with the signed APK/checksum, permission information, and model download sizes.

Debug builds are for development. Different debug signing keys cannot update each other, and uninstalling removes local history/audio. No production signing credentials are in this repository.

## Stores

Google Play needs a signed App Bundle, current target-SDK compliance, listing, privacy policy, Data safety form, and applicable accessibility/foreground-service declarations. Check current store policy before submission.

There is no iOS implementation. An App Store release requires a separate app, platform-appropriate input integration, signing, and testing. Android's accessibility overlay is not an iOS API.

## Experimental models and readback

For 0.8.0, compare Nemotron and Parakeet on the same saved audio using the in-app tool, including older 4–6 GB and 8 GB phones. Confirm cancellation preserves recordings and releases wakefulness. Test Piper playback, Stop, audio-focus loss, leaving the app, and starting microphone capture during readback. Review the GPL-3.0 eSpeak NG attribution and corresponding-source links in MODEL-NOTICES.md before distributing binaries; the app source licence does not replace runtime obligations.
