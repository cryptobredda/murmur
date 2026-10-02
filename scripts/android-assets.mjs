import { cp, mkdir, rm } from "node:fs/promises";
const path = "android/app/src/main/assets/www";
await rm(path, { recursive: true, force: true });
await mkdir(path, { recursive: true });
await cp("dist/client", path, {
  recursive: true,
  filter: (src) => !src.endsWith(".apk") && !src.includes("/downloads/"),
});
// APK assets are already available offline; browser service workers are unnecessary.
await rm(path + "/sw.js", { force: true });
console.log("Bundled app assets prepared for Android.");
