import test from "node:test";
import assert from "node:assert/strict";
import {
  formatText,
  resample,
  wavBytes,
  validateEndpoint,
  validateBackup,
} from "../src/core.mjs";
const natural = { style: "natural", removeFillers: true, voiceCommands: true };
test("Dictation cleans fillers and obeys spoken layout commands", () => {
  assert.equal(
    formatText(
      "um hello Alex comma new paragraph are you free question mark",
      natural,
    ),
    "Hello Alex,\n\nAre you free?",
  );
  assert.equal(
    formatText("Umberto came to say hi.", natural),
    "Umberto came to say hi.",
  );
});
test("Personal terms preserve exact spelling, boundaries and Unicode", () => {
  assert.equal(
    formatText("we use open a i with Açai", natural, [
      { spoken: "open a i", replacement: "OpenAI" },
      { spoken: "Açai", replacement: "Açaí" },
    ]),
    "We use OpenAI with Açaí",
  );
  assert.equal(
    formatText("a star and starting", natural, [
      { spoken: "star", replacement: "★" },
    ]),
    "A ★ and starting",
  );
  assert.equal(
    formatText("c++ and c++17", natural, [
      { spoken: "c++", replacement: "C Plus Plus" },
    ]),
    "C Plus Plus and c++17",
  );
});
test("Verbatim preserves model output and ignores formatting replacements", () => {
  assert.equal(
    formatText("um new line open a i", { ...natural, style: "verbatim" }, [
      { spoken: "open a i", replacement: "OpenAI" },
    ]),
    "um new line open a i",
  );
  assert.equal(
    formatText("hello", { ...natural, style: "polished" }),
    "Hello.",
  );
});
test("Audio resampling preserves duration and valid WAV headers", () => {
  const original = Float32Array.from(
    { length: 48000 },
    (_, i) => Math.sin((2 * Math.PI * 440 * i) / 48000) * 0.5,
  );
  const pcm = resample(original, 48000);
  assert.equal(pcm.length, 16000);
  const wav = wavBytes(pcm);
  const view = new DataView(wav);
  assert.equal(
    new TextDecoder().decode(new Uint8Array(wav).slice(0, 4)),
    "RIFF",
  );
  assert.equal(view.getUint32(24, true), 16000);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(40, true), 32000);
  assert.equal(wav.byteLength, 32044);
  assert.ok(
    Math.abs(pcm[100] - Math.sin((2 * Math.PI * 440 * 100) / 16000) * 0.5) <
      0.05,
  );
});
test("Cloud endpoints require explicit secure destinations", () => {
  assert.equal(
    validateEndpoint("https://speech.example.com/v1/audio/transcriptions"),
    "https://speech.example.com/v1/audio/transcriptions",
  );
  assert.equal(
    validateEndpoint("http://localhost:8080/v1/audio/transcriptions"),
    "http://localhost:8080/v1/audio/transcriptions",
  );
  for (const bad of [
    "http://example.com",
    "javascript:alert(1)",
    "https://key:secret@example.com",
    "not-a-url",
  ])
    assert.throws(() => validateEndpoint(bad));
});
test("Backup validation rejects corrupted data before opening a write transaction", () => {
  const t = {
    id: "one",
    text: "Hello.",
    raw: "hello",
    createdAt: Date.now(),
    duration: 3,
    source: "local",
    model: "Whisper Tiny",
    style: "natural",
    starred: false,
  };
  assert.equal(
    validateBackup({
      app: "murmur",
      version: 1,
      transcripts: [t],
      words: [],
      snippets: [],
    }).transcripts.length,
    1,
  );
  assert.throws(() =>
    validateBackup({
      app: "murmur",
      version: 1,
      transcripts: [t, t],
      words: [],
      snippets: [],
    }),
  );
  assert.throws(() =>
    validateBackup({
      app: "murmur",
      version: 1,
      transcripts: [{ ...t, duration: -1 }],
      words: [],
      snippets: [],
    }),
  );
});

test("Voice snippets keep their saved text literal", () => {
  assert.equal(
    formatText(
      "my sign off",
      natural,
      [],
      [{ phrase: "my sign off", text: "Regards, Umberto — the New Line team" }],
    ),
    "Regards, Umberto — the New Line team",
  );
});

test("Spoken backtracking keeps the final time and day without changing unrelated prose", async () => {
  const { resolveCorrections } = await import("../src/core.mjs");
  assert.equal(
    resolveCorrections(
      "Meet at 4 pm, actually 3 pm on Friday, actually Monday.",
    ),
    "Meet at 3 pm on Monday.",
  );
  assert.equal(
    resolveCorrections("This actually works and I am sorry about the delay."),
    "This actually works and I am sorry about the delay.",
  );
  assert.equal(
    resolveCorrections("Hi Alex, actually Marcus, are you free?"),
    "Hi Marcus, are you free?",
  );
});
test("Lists require list context and preserve ordinary numbers", async () => {
  const { numberedLists } = await import("../src/core.mjs");
  assert.equal(
    numberedLists("I have one question and two children."),
    "I have one question and two children.",
  );
  assert.equal(
    numberedLists("Going to the store for 1. Apples 2. Bananas 3. Oranges."),
    "Going to the store for:\n1. Apples\n2. Bananas\n3. Oranges.",
  );
});
test("Vocabulary learning accepts a spelling correction and rejects broader rewrites", async () => {
  const { learnCorrection } = await import("../src/core.mjs");
  assert.deepEqual(
    learnCorrection(
      "Hello bishop, how are you?",
      "Hello Biswaroop, how are you?",
    ),
    { spoken: "bishop", replacement: "Biswaroop" },
  );
  assert.equal(learnCorrection("Hello Alex.", "Greetings Marcus."), null);
  assert.equal(learnCorrection("Hello Alex.", "Hello Alex and Sam."), null);
});
test("Editing guards reject invented numbers and changed saved snippets", async () => {
  const { validEditedText } = await import("../src/core.mjs");
  assert.equal(validEditedText("Meet at 3 pm.", "Meet at 5 pm."), false);
  assert.equal(
    validEditedText("Hello OpenAI.", "Hello Open AI.", ["OpenAI"]),
    false,
  );
  assert.equal(
    validEditedText("Hello OpenAI.", "Hello OpenAI!", ["OpenAI"]),
    true,
  );
});
test("Per-app style keeps literal snippets and supports developer identifiers", async () => {
  const { chooseProfile, codeFormat } = await import("../src/core.mjs");
  assert.equal(
    chooseProfile(
      [{ packages: "com.google.android.gm,outlook", tone: "formal" }],
      "com.google.android.gm",
    ).tone,
    "formal",
  );
  assert.equal(
    formatText(
      "my sign off",
      { ...natural, tone: "very-casual" },
      [],
      [{ phrase: "my sign off", text: "Regards, Umberto — OpenAI" }],
    ),
    "Regards, Umberto — OpenAI",
  );
  assert.equal(
    codeFormat("snake case user profile equals value"),
    "user_profile = value",
  );
});

test("Automatic AI cleanup keeps dictation content and rejects unrelated assistant replies", async () => {
  const { validEditedText } = await import("../src/core.mjs");
  assert.equal(
    validEditedText(
      "Ask what you can do for your country.",
      "I am pleased to assist you in refining your written content.",
    ),
    false,
  );
  assert.equal(
    validEditedText(
      "We're meeting Alex tomorrow at noon",
      "We are meeting Alex tomorrow at noon.",
    ),
    true,
  );
  assert.equal(
    validEditedText(
      "Please email Jordan the attached invoice.",
      "Please email Jordan about a birthday party.",
    ),
    false,
  );
  assert.equal(
    formatText("open a i", { ...natural, tone: "very-casual" }, [
      { spoken: "open a i", replacement: "OpenAI" },
    ]),
    "OpenAI",
  );
});

test("Automatic editing accepts punctuation changes in unspaced languages", async () => {
  const { validEditedText } = await import("../src/core.mjs");
  assert.equal(
    validEditedText("你好明天我们一起去学校", "你好，明天我们一起去学校。"),
    true,
  );
});
