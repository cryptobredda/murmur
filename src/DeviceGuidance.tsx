import { useEffect, useState } from "react";
import { androidDevice, type AndroidDevice } from "./native";
import { assessDevice } from "./device";

export function DeviceGuidance({ withWriting = false }: { withWriting?: boolean }) {
  const [device, setDevice] = useState<AndroidDevice | null>(androidDevice);
  useEffect(() => {
    const refresh = () => setDevice(androidDevice());
    window.addEventListener("murmur-native-launch", refresh);
    return () => window.removeEventListener("murmur-native-launch", refresh);
  }, []);
  const assessment = device ? assessDevice(device, withWriting) : null;
  return (
    <aside className="device-guidance" aria-label="Local model device recommendations">
      <strong>Recommended phone</strong>
      <p>
        {withWriting ? "12 GB RAM · 3 GB free storage for speech and writing" : "8 GB RAM · 1.5 GB free storage for speech"}
        <br />Android 13 or newer · recent flagship processor, such as Snapdragon 8 Gen 2, 8 Gen 3 or 8 Elite.
      </p>
      {device && assessment && (
        <p className="device-current">
          <strong>This phone:</strong> {device.model} · Android {device.androidVersion}
          <br />{(device.ramBytes / 2 ** 30).toFixed(1)} GB RAM reported by Android · {(device.freeStorageBytes / 1e9).toFixed(1)} GB free
          <br />{!assessment.compatible ? "Requires Android 8+ and a 64-bit ARM phone." : assessment.recommendedRam ? "RAM matches this recommendation." : `RAM is below the ${assessment.recommendedRamGB} GB recommendation; processing can be slower.`}
        </p>
      )}
      <details>
        <summary>Requirements and sources</summary>
        <p>
          The APK requires Android 8+ and 64-bit ARM. Android 13+ improves insertion into modern text fields.
          These RAM and storage figures are practical recommendations, not certified minimums. Storage allows for model files and working space before download; saved recordings need additional space.
          Speed also depends on recording length, temperature and other apps.
        </p>
        <p>
          <a href="https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3" target="_blank" rel="noreferrer">Parakeet model card</a>{" · "}
          <a href="https://k2-fsa.github.io/sherpa/onnx/android/apk.html" target="_blank" rel="noreferrer">Android speech runtime</a>{" · "}
          <a href="https://huggingface.co/litert-community/Qwen3-1.7B/blob/73fbc3fe8271c162a603ee66f6e7ed25b6211195/README.md" target="_blank" rel="noreferrer">Qwen3 Android measurements</a>
        </p>
        <p>
          Parakeet's publisher quotes 2 GB to load the original Linux model, which is not a 2 GB Android phone minimum.
          Qwen3's community Android measurements are from a Galaxy S26 and do not establish a universal phone requirement.
        </p>
      </details>
      {!device && <p>Install the Android APK for local models. The browser can use your cloud provider.</p>}
    </aside>
  );
}
