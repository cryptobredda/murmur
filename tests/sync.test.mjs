import test from "node:test";
import assert from "node:assert/strict";
import {
  encryptSnapshot,
  decryptSnapshot,
  mergeSnapshots,
  normalizeSyncPreferences,
  synchronize,
} from "../src/sync.mjs";
const row = (id, time, text = "Hello") => ({
  id,
  text,
  raw: text,
  createdAt: 10,
  updatedAt: time,
  duration: 2,
  source: "local",
  model: "Whisper Tiny",
  style: "natural",
  starred: false,
});
const snapshot = (transcripts = [], extra = {}) => ({
  app: "murmur",
  version: 1,
  transcripts,
  words: [],
  snippets: [],
  deletions: [],
  ...extra,
});
test("Sync encryption authenticates content and rejects a wrong passphrase", async () => {
  const original = snapshot([row("one", 20)]),
    encrypted = await encryptSnapshot(original, "correct horse battery staple");
  assert.equal(JSON.stringify(encrypted).includes("Hello"), false);
  assert.deepEqual(
    await decryptSnapshot(encrypted, "correct horse battery staple"),
    original,
  );
  await assert.rejects(decryptSnapshot(encrypted, "incorrect passphrase"));
  await assert.rejects(
    decryptSnapshot(
      { ...encrypted, data: encrypted.data.slice(0, -4) + "AAAA" },
      "correct horse battery staple",
    ),
  );
});
test("Sync merges newer edits and keeps deletions from reappearing", () => {
  const local = snapshot([row("one", 30, "Updated"), row("two", 20)], {
      deletions: [{ store: "history", id: "gone", time: 40 }],
    }),
    remote = snapshot([row("one", 20), row("gone", 30), row("three", 50)]);
  const merged = mergeSnapshots(local, remote);
  assert.deepEqual(
    merged.transcripts.map((x) => [x.id, x.text]),
    [
      ["one", "Updated"],
      ["three", "Hello"],
      ["two", "Hello"],
    ],
  );
});
test("Vocabulary-only sync keeps personal history local", async () => {
  const local = snapshot([row("private", 20)]),
    remote = snapshot([row("teammate", 30)], {
      words: [{ id: "name", spoken: "bishop", replacement: "Biswaroop" }],
    });
  const result = mergeSnapshots(local, remote, "vocabulary");
  assert.deepEqual(result.transcripts, local.transcripts);
  assert.equal(result.words[0].replacement, "Biswaroop");
});
test("Synced preferences cannot replace endpoint, provider, or stored credentials", () => {
  assert.deepEqual(
    normalizeSyncPreferences({
      tone: "formal",
      provider: "custom",
      cloudEndpoint: "https://attacker.example",
      rememberKey: true,
      "api-key": "secret",
      onboardingComplete: true,
    }),
    { tone: "formal" },
  );
});
test("Sync uses conditional writes to avoid overwriting simultaneous remote changes", async () => {
  const encrypted = await encryptSnapshot(snapshot(), "test passphrase"),
    before = globalThis.fetch;
  let writes = 0;
  globalThis.fetch = async (url, options = {}) =>
    options.method === "PUT"
      ? (writes++,
        assert.equal(options.headers["If-Match"], '"revision-1"'),
        new Response("", { status: 412 }))
      : new Response(JSON.stringify(encrypted), {
          headers: { ETag: '"revision-1"' },
        });
  try {
    await assert.rejects(
      synchronize(
        snapshot(),
        {
          endpoint: "https://sync.example/murmur.enc.json",
          username: "",
          password: "",
          passphrase: "test passphrase",
        },
        "all",
        new AbortController().signal,
      ),
      /Another device updated/,
    );
    assert.equal(writes, 1);
  } finally {
    globalThis.fetch = before;
  }
});

test("Sync refuses an existing file without an exposed strong ETag", async () => {
  const encrypted = await encryptSnapshot(snapshot(), "test passphrase"),
    before = globalThis.fetch;
  let writes = 0;
  globalThis.fetch = async (url, options = {}) => {
    if (options.method === "PUT") writes++;
    return new Response(JSON.stringify(encrypted));
  };
  try {
    await assert.rejects(
      synchronize(
        snapshot(),
        {
          endpoint: "https://sync.example/file",
          username: "",
          password: "",
          passphrase: "test passphrase",
        },
        "all",
        new AbortController().signal,
      ),
      /strong ETag/,
    );
    assert.equal(writes, 0);
  } finally {
    globalThis.fetch = before;
  }
});
test("Vocabulary-only uploads exclude personal history, preferences and history deletions", async () => {
  const before = globalThis.fetch;
  let upload;
  globalThis.fetch = async (url, options = {}) => {
    if (options.method !== "PUT") return new Response("", { status: 404 });
    upload = await decryptSnapshot(JSON.parse(options.body), "test passphrase");
    return new Response(null, { status: 204 });
  };
  try {
    await synchronize(
      snapshot([row("private", 20)], {
        preferences: { tone: "formal" },
        deletions: [{ store: "history", id: "deleted", time: 30 }],
      }),
      {
        endpoint: "https://sync.example/file",
        username: "",
        password: "",
        passphrase: "test passphrase",
      },
      "vocabulary",
      new AbortController().signal,
    );
    assert.deepEqual(upload.transcripts, []);
    assert.deepEqual(upload.preferences, {});
    assert.deepEqual(upload.deletions, []);
  } finally {
    globalThis.fetch = before;
  }
});
