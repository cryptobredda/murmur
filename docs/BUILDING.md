# Build Murmur

Murmur bundles a React/TypeScript interface in an Android WebView, with Java services for audio capture, accessibility, the floating control, and local inference. The Android APK is required for local models and cross-app dictation.

## Prerequisites

- Node.js 22+, npm, Git, and JDK 21 (`JAVA_HOME` pointing to your JDK).
- Android SDK platform 35 and Build Tools 35.0.0. Set `ANDROID_HOME` or `ANDROID_SDK_ROOT` to your SDK directory and accept the SDK licences.
- Android NDK **28.2.13676358** and CMake **3.31.6**, installed with SDK Manager.
- Internet for npm, Gradle/Maven dependencies, the pinned native SDK sources, and the checksum-verified Sherpa-ONNX runtime download. Models are downloaded inside the installed app.

Install the SDK using Android Studio's SDK Manager. Machine-specific paths belong in the environment or an untracked `android/local.properties`.

## Build a test APK

```sh
npm ci
npm test
npm run build
node scripts/android-assets.mjs
cd android
./gradlew testDebugUnitTest lintDebug assembleDebug
```

On Windows, use `gradlew.bat`. Gradle 8.10.2 is pinned with a distribution checksum. Native dependencies are configured in `android/app/build.gradle`. The pre-build task cross-compiles pinned NeMo-Speech.cpp, GGML and SentencePiece into ARM64 libraries via `scripts/build-nemotron.mjs`. This requires Git and adds time to the first build; later builds are incremental. Sources and generated binaries stay under ignored `android/app/build/nemotron/`. No model weights enter the repository or APK.

SDK command-line package names: `platforms;android-35`, `build-tools;35.0.0`, `ndk;28.2.13676358`, `cmake;3.31.6`.

Output: `android/app/build/outputs/apk/debug/app-debug.apk`. The package is `app.murmur.mobile`, currently version `0.8.0-test`. It targets ARM64 phones; x86 emulators cannot run its native inference libraries.

## Install

```sh
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Allow installs from your chosen installer if Android asks. Onboarding downloads models inside Murmur. Grant microphone access and enable the accessibility service to test the floating control.

Debug APKs use the build machine's debug signing key. Different keys cannot update one another. Uninstalling deletes app data, so preserve history and export recordings before uninstalling. Production builds should use a maintainer-owned release key kept outside Git.

## Develop and preview

Run `npm run dev` and use Vite's printed URL. For a production preview, run `npm run build` then `npm run preview`. Browser previews can use configured cloud providers, but cannot run the native models or display the native cross-app overlay. Microphone capture requires a secure context such as localhost or HTTPS.

## Update screenshots

```sh
npx playwright install chromium
npm run docs:capture
```

Set `CHROME_EXECUTABLE` to use an installed Chromium executable. The script captures the real bundled UI with fictional data and a simulated Android bridge, without reading personal history or recordings. See [IMAGERY.md](IMAGERY.md).

Follow [RELEASE.md](RELEASE.md) before distributing an APK. No signing key is included in this repository.

## Model UI and native checks

After `npm run build`, run `npx playwright install chromium` followed by `npm run test:ui`. Set `CHROME_EXECUTABLE` to use an installed Chromium instead. This checks downloads, persisted model selection, saved-audio comparison/export, cancellation and wake release, and optional readback using fictional bridge data. It does not execute models or establish phone speed. Real JNI/model smoke-test instructions and physical-device scenarios are in [MOBILE-MODELS.md](MOBILE-MODELS.md).
