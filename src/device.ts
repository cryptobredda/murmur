export const localRequirements = {
  minAndroidSdk: 26,
  recommendedAndroidSdk: 33,
  speechRamGB: 8,
  writingRamGB: 12,
  speechStorageGB: 1.5,
  writingStorageGB: 3,
} as const;

export function assessDevice(device: { sdk: number; arm64: boolean; ramBytes: number }, withWriting: boolean) {
  const recommendedRamGB = withWriting ? localRequirements.writingRamGB : localRequirements.speechRamGB;
  return {
    compatible: device.sdk >= localRequirements.minAndroidSdk && device.arm64,
    // Android excludes reserved memory from totalMem. Compare with usable RAM,
    // leaving 15% for that reservation rather than rejecting an advertised 8/12 GB phone.
    recommendedRam: device.ramBytes >= recommendedRamGB * 2 ** 30 * 0.85,
    recommendedRamGB,
    modernEditorSupport: device.sdk >= localRequirements.recommendedAndroidSdk,
  };
}
