# Security policy

Use GitHub private vulnerability reporting: **Security → Report a vulnerability**. Include affected versions, reproduction steps, impact, and redacted evidence. Do not include live credentials or private audio.

Do not report exploitable vulnerabilities publicly. If private reporting is unavailable, request a private channel through the owner's GitHub contact options before sharing details.

The current preview branch is maintained; historical testing APKs have no security-support guarantee. Areas of interest include the WebView bridge, accessibility insertion, audio retention/export, credentials, encrypted sync, and download integrity.

Keys, signing files, personal recordings, and private deployment configuration must never be committed. Pinned checksums protect model/runtime downloads. A clean credential scan is not a full security audit.
