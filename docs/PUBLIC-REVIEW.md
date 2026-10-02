# Public repository review — 2 October 2026

The public source snapshot includes the Android app, branded README, generated cover, six app UI captures, three floating-control previews, and build/privacy/device/contribution guides. The default branch contains the working source and documentation; this review branch adds automated build checks and these review notes.

## Verified locally

| Check | Result |
| --- | --- |
| JavaScript behaviour tests | 31 passed |
| TypeScript and production UI build | Passed |
| Android unit tests | 14 passed |
| Android lint | No errors; 19 warnings |
| Android debug APK assembly | Passed |
| Documentation links and image files | All local references resolve |
| UI captures | Rendered from the production bundle, fictional data, no page errors |
| Gitleaks 8.30.1 source and fresh Git history scans | No credential findings |
| npm production dependency audit | No reported vulnerabilities at check time |

## Public packaging

- Fresh Git history; private deployment history was not copied.
- No API keys, release/debug keystores, credential files, private deployment configuration, personal recordings, or original user screenshots included.
- Generated app bundles, SDK paths, models, node modules, and APKs stay out of Git.
- PNG documentation assets have no metadata fields; example text and device data are fictional.
- Author metadata uses the GitHub account's public noreply address.
- Model creators, conversions, pinned revisions, and licences remain attributed.

Credential scans cover this published snapshot and its new Git history. They do not certify every aspect of the app's security. The CI workflow uses pinned actions with read-only repository permissions and builds a debug APK without publishing a release.

## Maintainer review

- Review the README and image gallery for brand/feature accuracy.
- Review permissions, privacy wording, local device guidance, and third-party attribution.
- Check automated builds and repeat the physical-device scenarios in [RELEASE.md](RELEASE.md).
- Choose a production version and private signing key before publishing an APK.
- Publish the release/store listings when ready; this preparation does not submit to Google Play or the App Store.
