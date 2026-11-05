# Permission and Accessibility declarations

## Accessibility API

Murmur is a general voice-typing app; it does not declare itself an Accessibility Tool for disability support. The service is optional, uses Android's protected Accessibility binding, and is enabled by the user after an in-app disclosure and affirmative consent.

Suggested declaration: “Murmur uses Accessibility to locate a focused editable field, show a user-triggered dictation control and insert the resulting text using the current keyboard. Optional correction learning examines edits after a recent insertion and saves short corrections locally. Password fields and unrelated fields are excluded. The service does not perform autonomous actions or submit messages. Users control recording, output, correction learning and service enablement.”

Create the Console demonstration video on a physical phone: open setup, show the complete native disclosure, choose Agree and continue, enable the service in Android Settings, focus a supported field, start/stop dictation and show insertion/clipboard fallback. Demonstrate disabling the service and learning. The repository's static screenshots are not a substitute for this required workflow video.

## Foreground service

Microphone foreground service: user-initiated cross-app voice recording, with a visible quiet active-session notification and cancel/finish controls. Capture ends when the user finishes or cancels. Processing switches to the short-service type on supported Android versions, with a bounded processing timeout and durable saved audio. It is not an always-on listener. Complete the applicable Play Console FGS declaration using this flow.

## Other permissions

`RECORD_AUDIO` captures dictation. `INTERNET` downloads verified models and accesses optional user-configured services. `WAKE_LOCK` keeps active recording/processing awake; field focus alone does not hold it. `POST_NOTIFICATIONS` supports active-session visibility. No advertising ID, location, contacts or broad storage permission is used. Android's document/share interfaces handle user-requested exports/imports.

References: https://support.google.com/googleplay/android-developer/answer/10964491 and https://support.google.com/googleplay/android-developer/answer/13392821 . Approval is determined by Google Play review, not by this document.
