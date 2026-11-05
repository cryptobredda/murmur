# Murmur 0.9 release-candidate review

Prepared 18 October 2026 for **Zyralabs**, support/privacy **info@zyralabs.xyz**. Android is the release candidate. The iOS implementation is deferred; its store folder contains explicitly labelled artwork/copy drafts.

## Result

Parakeet remains the default local model. Personal dictionary targets can guide recognition, short pauses retain more context, and English cleanup defaults to British spellings. Background corrections are imported before processing without requiring the main app to reopen. See [BRITISH-ENGLISH.md](BRITISH-ENGLISH.md) for the implementation and the limits of the speech checks; no general acoustic-accuracy percentage improvement has been established.

The [store pack](../store/README.md) contains five Play listing pictures, a feature graphic, store icons, listing copy, privacy policy and permission/Data safety worksheets. Captures use the actual production UI with fictional data and a simulated native bridge. The floating image is labelled as a preview. They are not physical-device test evidence or iPhone screenshots.

## Checks performed

- **39 JavaScript tests**, TypeScript and production build passed.
- **25 native Java unit tests** passed; debug and release lint have **0 errors, 21 warnings**. Lint is not warning-free.
- Browser UI checks passed for downloads/model selection, comparison/export, cancel/wake release, readback, accuracy/spelling persistence and dictionary hints. These use fictional bridge data.
- Store copy limits, contact, five screenshots, image dimensions/size and opaque icon checks passed.
- Production npm dependency audit: zero reported vulnerabilities at review time. Gitleaks found no credentials in the public candidate source or its committed history. These automated scans do not guarantee the absence of every security defect.
- The testing APK's certificate matches the earlier 0.8 testing APK. Its 15 frontend files match the production bundle, and its tokenizer vocabulary/model notices match source.
- All nine packaged ARM64 native libraries have ELF LOAD alignment of at least **16,384 bytes**. APK zip alignment passed. Recheck the final owner-signed bundle and Play device reports.
- Debug APK: `app.murmur.mobile`, version code **9**, `0.9.0-test`, minimum API **26**, target API **36**, ARM64 only.
- Release AAB: version `0.9.0`, non-debuggable and **unsigned**. Production signing material was not supplied or generated.

## Review artifacts

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Murmur-0.9.0-test.apk | 39,408,234 | `d2f10016d462f6a0c8133d40e3451bc56e53c9beed10515af8b76718e1a220c1` |
| Murmur-0.9.0-unsigned-review.aab | 35,000,702 | `110e44a97ed243f57811b0dd35acceaab762433ada52bc806ef47ee07236121e` |

These hashes identify this review's local build outputs. Rebuilding/signing produces different artifacts/hashes. No APK or signing key is committed to the source repository, and no GitHub production release or store submission is made by this review.

## Owner acceptance before publication

Test on the Samsung S25 Ultra with ordinary British English dictations, unfamiliar names/terms, pauses and longer recordings. Inspect raw recognition separately from optional rewriting. Test dictionary learning with the main app closed, cancel/retry/history recovery, offline downloads/recognition, protected fields, insertion/clipboard, overlay placement/pause/transparency, screen wake/release and the one-time Accessibility disclosure.

Build with your own upload key, test that exact signed artifact through Play's internal track, update the public privacy-policy URL after merging, and complete the Console declarations and physical-device permission-flow video. [Signing and remaining publication steps](../store/SIGNING.md). No physical S25 testing or Play approval is claimed by the automated checks.
