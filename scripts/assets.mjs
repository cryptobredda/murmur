import { rm } from "node:fs/promises";
// Remove obsolete browser model runtimes from incremental builds.
await rm("public/ort", { recursive: true, force: true });
