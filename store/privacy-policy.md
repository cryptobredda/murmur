# Murmur privacy policy

Effective 18 October 2026. Murmur is developed by **Zyralabs**. Contact **info@zyralabs.xyz** for support or privacy enquiries.

This policy describes the Android app. An iOS app is not currently available.

## Local dictation and storage

When you start dictating, Murmur records audio and saves it in the app's private storage so recognition can retry without making you repeat yourself. Local speech recognition and optional local writing/readback run on your device after their model downloads. Murmur stores transcripts, saved audio, dictionary entries, snippets, model/settings information and the app associated with a dictation. It does not operate a Murmur account or analytics service, and contains no advertising SDK.

Audio and history remain until you delete them, clear app storage or uninstall. Delete individual entries and recordings in History, or clear data in Settings. Exported files are copies you control and must delete separately. Android's sandbox and device protection protect app storage; Murmur does not add a separate encryption layer to local audio or transcripts.

## Microphone and Accessibility

The microphone records after you start a dictation, rather than when you simply focus a field. Android displays an active-session notification during background recording/processing.

The optional Accessibility service reads the focused text field and cursor/app information to show the floating control, insert dictation and choose writing profiles. Password fields are excluded. If correction learning is enabled, it observes edits in the same field for up to two minutes after insertion and learns short word/phrase corrections associated with that dictation. Changes outside the inserted region are excluded where its boundaries can be identified. It does not continuously collect typing across other fields. An in-app disclosure and consent precede this feature. Turn learning off in Murmur or disable the service in Android Accessibility Settings at any time.

Personal dictionary terms can guide local recognition. Pending learned corrections are kept locally until their dictionary writes succeed. Disabling correction learning clears pending corrections, while existing dictionary entries remain under your control.

## Optional cloud processing

Local mode does not upload your recordings for recognition. If you choose a cloud speech provider, Murmur sends audio, language/model parameters and your configured authentication to that endpoint. If you choose cloud writing, recognised text, writing instructions and applicable selected/draft text are sent to the provider you configure. OpenAI, Groq or a custom endpoint may process this data under their own terms, retention policies and charges. You can use local speech and Smart cleanup without these options.

Model downloads contact the hosts identified in the pinned model manifest, including Hugging Face and its delivery services. Hosts receive normal connection information such as your IP address. Models download over HTTPS and verify their pinned checksums.

## Optional sync, export and clipboard

If you enable sync, Murmur sends a passphrase-encrypted snapshot to your configured HTTPS/WebDAV storage. You choose whether to sync vocabulary only or also text history/preferences. Audio and provider credentials are excluded. Your storage provider can see connection information and encrypted data. Deleting local data does not automatically delete previously exported files, your storage provider's backups or data retained by cloud providers; manage those copies with the relevant provider.

Clipboard fallback places completed text on Android's clipboard. Android controls clipboard access and retention. Export/share happens when you request it; the receiving app or destination then controls the copy. A model-comparison export includes recognised/reference text and device/model/timing information, only when you choose to export it.

## Credentials and choices

Remembered provider credentials use Android Keystore-backed encryption. Session credentials stay in process memory. Credentials are excluded from text backups and sync. Browser previews use browser storage rather than Android Keystore and are not the Android store app.

No name, email, contacts, location or advertising identifier is required to use local dictation. Your own audio/text may contain personal information. You choose what to dictate, whether to enable cloud/sync/learning, and what to delete or export. Contact Zyralabs at **info@zyralabs.xyz** for questions or assistance.

Updates to processing or this policy will be reflected here with an updated effective date. The app's source and permission documentation are available at https://github.com/cryptobredda/murmur.
