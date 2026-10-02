# Privacy and permissions

Murmur processes local speech and optional local writing on your phone. You choose whether to enable cloud providers or sync.

## Where information goes

| Action | Information and destination |
| --- | --- |
| Local dictation | Microphone audio is saved and processed in private app storage on your phone. |
| Local writing | Recognized text and applicable writing instructions are processed on your phone. |
| Model downloads | HTTPS requests go to the model hosts in the pinned manifest. Hosts receive normal connection metadata such as IP address. |
| Optional cloud speech | Audio and parameters go directly to your chosen speech endpoint using your credentials. |
| Optional cloud writing | Text and writing instructions go to your chosen writing endpoint. |
| Optional sync | An encrypted snapshot goes to the HTTPS/WebDAV storage you specify. The server sees connection metadata and encrypted data. |
| Clipboard fallback | Completed text goes to Android's clipboard, subject to Android's access and retention rules. |

Murmur has no account server, advertising, or analytics SDK. Cloud providers and storage hosts have their own terms and privacy practices.

## Permissions and services

- **Microphone:** captures audio after you start dictating. Field focus alone does not record.
- **Accessibility:** identifies editable fields and inserts text. The current app identifier and applicable draft/selection context may be used for writing profiles or commands. Password fields are excluded. Enable this sensitive capability only for builds you trust.
- **Accessibility overlay:** displays the control through Murmur's enabled accessibility service. Protected windows and some editors may prevent it from appearing.
- **Foreground microphone service and notification:** Android requires these for active background capture. The notification is quiet and provides active-session controls.
- **Wakefulness:** capture and processing keep the phone awake until output or cancellation. Focusing a field alone does not.
- **Internet:** downloads models and optionally contacts configured providers/storage.

## History, audio, and deletion

History stores completed text, raw recognition, model information, and saved audio references. Retained audio lets failed or interrupted recognition reuse the same recording. It is not automatically uploaded in local mode.

You can edit/delete history, play recordings, export WAV audio, and export text backups. Text backups and sync exclude audio and provider credentials; export recordings separately to preserve them. Deleting a history entry deletes its recording when it is not busy. Clearing app storage or uninstalling deletes local data and downloaded models.

Recordings and transcripts rely on Android's sandbox and device protection; Murmur does not separately encrypt them at rest. Exported WAV/text files should be handled like personal documents.

## Credentials

The native app encrypts remembered provider/sync credentials with AES-GCM and an Android Keystore key. Session credentials stay in process memory. Keys are not bundled in the repository and are excluded from text backups and sync.

The browser preview uses browser storage if you remember credentials, without Android Keystore. Prefer session credentials on trusted devices when using previews.

## Optional sync

Sync uses AES-256-GCM with a PBKDF2-derived key from your passphrase. Use a strong, private passphrase. Endpoint authentication and automatic sync are configurable. Vocabulary-only mode shares words/snippets without transcript history. Audio is excluded, so sync is not a complete recording backup.

Report vulnerabilities privately using [SECURITY.md](../SECURITY.md). Do not post keys, private audio, transcripts, or signing credentials publicly.
