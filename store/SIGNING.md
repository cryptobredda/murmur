# Build and sign for Google Play

The testing APK remains signed with the development certificate used for previous tests, so it can update those installations. A development certificate is not your Play upload key.

The Play-signed app cannot update an installation with a different test certificate. Export text backups and any recordings you want to keep before uninstalling a test build; uninstalling removes its local history/audio. Import/export is user-controlled, and the text backup does not contain audio files.

For production, create and securely retain your own upload keystore using Android Studio **Generate Signed Bundle / APK → Android App Bundle**. Use `app.murmur.mobile` unless you intentionally register a different application ID before the first release. Keep the keystore, aliases/passwords and recovery information outside this repository. Choose Play App Signing in Play Console and retain your upload-key recovery material.

The Gradle release build accepts these environment variables:

```text
MURMUR_UPLOAD_KEYSTORE=/absolute/path/to/your-upload-keystore.jks
MURMUR_UPLOAD_STORE_PASSWORD=<your keystore password>
MURMUR_UPLOAD_KEY_ALIAS=<your upload alias>
MURMUR_UPLOAD_KEY_PASSWORD=<your key password>
```

Set them in protected local tooling/CI secrets; do not commit real values. Then build:

```sh
npm ci --ignore-scripts
npm test
npm run build
node scripts/android-assets.mjs
cd android
./gradlew testDebugUnitTest lintRelease bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`. Without signing variables, Gradle produces an **unsigned review bundle**, which cannot be uploaded to Play as a signed release. The store check script validates copy and pictures, not bundle signing. Verify the final signature, version code, API target, dependency licences and 16 KB native alignment. Test the exact signed artifact through Play's internal track before production.

Before publishing, merge the review branch, point the listing's privacy URL at the merged public policy, upload the pictures/text, complete Data safety / Accessibility / FGS / content-rating / app-access declarations, supply the physical-device permission-flow video and meet any testing requirements for your Play developer account. Zyralabs is the publisher contact, not an automatically created Play Console identity.

iOS publication is deferred. Apple signing, bundle registration, a native iOS implementation, real iPhone screenshots and App Store privacy labels are not supplied by an Android AAB.
