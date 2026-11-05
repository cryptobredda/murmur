# Google Play Data safety worksheet

This worksheet describes implemented flows. Review the final build and the providers you offer before submitting the Console form. Do not answer “no data collected” solely because local mode is the default: optional cloud processing sends user data off device.

| Data / feature | Default local mode | Optional transfer | Purpose / controls |
| --- | --- | --- | --- |
| Voice/audio recordings | Stored and processed on device | Sent to the chosen speech endpoint in cloud mode | App functionality; optional cloud setting; delete local clips in History |
| Dictation text / other user-generated content | Stored and processed on device | Cloud writing sends text/instructions and applicable selected/draft text to the chosen endpoint | App functionality; optional writing provider |
| Vocabulary / preferences / text history | Local | User-configured sync uploads an end-to-end encrypted snapshot; vocabulary-only scope is available | Optional sync; audio and credentials excluded |
| Associated app metadata | Used locally for insertion/profiles and history | Can be part of an encrypted all-history sync snapshot | Optional sync; not analytics |
| API authentication | Session memory or encrypted local storage | Authentication goes to the provider the user chooses | User-configured cloud/sync access |
| Device/model/timing information | Displayed locally | Explicit comparison-result export via the user's share action | Optional user-directed export; no automatic telemetry |
| Connection metadata | No recognition upload in local mode | Model hosts and chosen providers see normal HTTPS connection information | Model delivery and user-selected services |

- No ad/analytics SDK, advertising identifier, location or contacts permission is implemented. There is no Murmur account and no account-deletion server flow to advertise.
- Audio and text sent to a cloud provider are not necessarily processed ephemerally; check provider retention terms. Do not tick ephemeral processing without verifying the actual service.
- Network model/provider/sync traffic uses HTTPS. Local recordings are sandboxed, not separately encrypted by Murmur. Keystore credential encryption and passphrase-encrypted sync are separate mechanisms.
- Apply Google's current distinctions for end-to-end-encrypted backups, service providers and explicit user-directed exports when choosing “collected” versus “shared”. For cloud mode, review the Audio/Voice recordings and Other user-generated content categories at minimum. Declare transfers as optional where the user can use local mode without them.
- Users can delete local history/audio and dictionary entries. They manage exported copies, remote storage backups and provider-retained data separately. Support: info@zyralabs.xyz.

Reference: https://support.google.com/googleplay/android-developer/answer/10787469
