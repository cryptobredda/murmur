# Contributing to Murmur

Focused fixes, device reports, documentation, and language feedback are welcome. Start with [BUILDING.md](docs/BUILDING.md), then open a branch and pull request explaining the user-visible change and verification.

## Reports

Include app version, phone/Android version, speech/writing configuration, affected app, and reproduction steps. For dictation errors, distinguish raw recognition from subsequent writing. Use short fictional examples. Do not publish someone else's audio without permission.

Never include API keys, signing credentials, private account screens, or personal history. Report vulnerabilities privately using [SECURITY.md](SECURITY.md).

## Changes

- Keep automatic dictation quiet and compact.
- Preserve saved audio through failures and cancellation.
- Keep credentials/audio out of text backups and sync.
- Follow the existing brand, overlay design, and device guidance.
- Add meaningful coverage for behaviour changes; verify visual/docs changes by rendering.
- Record model/runtime provenance and licence changes in [MODEL-NOTICES.md](MODEL-NOTICES.md).

Run `npm test` and `npm run build`. Native changes also need Android unit tests, lint, and appropriate physical-device checks. Reproduce UI images with `npm run docs:capture`.

App source contributions use MIT; third-party components retain their own licences. Keep discussions respectful and specific.
