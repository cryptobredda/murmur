# Murmur store submission pack

**Developer: Zyralabs · Support/privacy: info@zyralabs.xyz**

Android is prepared as a release candidate. The maintainer owns signing, physical-device acceptance testing, Play Console declarations and publication. The iOS app is deferred; its folder contains brand assets and copy drafts, not an upload-ready iOS release.

## Google Play

- `google-play/metadata/en-GB/`: title, short/full descriptions and release notes in a Fastlane-style layout for review/manual upload.
- `google-play/metadata/en-GB/images/`: 512×512 opaque icon, 1024×500 feature graphic and five 1080×1920 phone listing images.
- `source-screens/`: production UI renders with fictional data used for the listing pictures. Floating imagery is a control preview. These pictures demonstrate app UI and are not device-performance evidence.
- [Privacy policy](privacy-policy.md), [Data safety worksheet](google-play/data-safety.md), [permission declarations](google-play/permissions.md), [reviewer instructions](google-play/reviewer-instructions.md).
- [Signing and publication](SIGNING.md). The test APK uses the existing debug certificate. The review AAB is unsigned; build/sign with your own upload key for Play Console.

The app targets **API 36**, as required for new submissions from 31 August 2026. New native libraries retain 16 KB alignment. Check the final signed bundle and every dependency before submission. No production signing keys or passwords are included in Git.

## Apple App Store — deferred

`apple/drafts/` contains an opaque 1024×1024 brand icon, platform-neutral artwork/copy and an explicit deferred-release note. It does not contain fabricated iPhone screenshots, an IPA or an Xcode app. Real App Store screenshots, platform permissions, privacy labels, model/runtime licensing, signing and physical-device validation follow the future iOS implementation. iOS does not provide Android's cross-app Accessibility overlay API.

## Regenerate and validate

```sh
npm run build
CHROME_EXECUTABLE=/usr/bin/chromium npm run store:assets
npm run store:check
```

Omit `CHROME_EXECUTABLE` to use Playwright's installed Chromium. [listing.json](listing.json) is the copy/contact source; generated text and image files are committed for review. Images use the existing Murmur palette, logo and bundled fonts. No personal account data, transcripts or recordings are used.

Requirements checked 18 October 2026: [Google Play target SDK](https://support.google.com/googleplay/android-developer/answer/11926878), [Google Play preview assets](https://support.google.com/googleplay/android-developer/answer/9866151), [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/).
