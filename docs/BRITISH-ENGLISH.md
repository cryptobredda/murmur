# English recognition and personal vocabulary in 0.9

Parakeet TDT v3 remains the default local recogniser. This update changes its decoding, context and correction pipeline; it does not replace, retrain or fine-tune its acoustic model.

## What changes

- **Personal vocabulary during recognition.** Accurate mode supplies dictionary replacement terms to Parakeet's four-path modified beam search. This can bias the decoder towards your names and terminology. Without saved terms, the original greedy decoder is retained. Fast always uses the original decoder. There is no extra speech-model download.
- **Context through short pauses.** A natural segment now needs at least ten seconds of speech/context and 1.2 seconds of silence, rather than six seconds and 0.85 seconds. Finishing a dictation still flushes immediately. Long audio retains the existing 35-second cap/overlap; saved PCM is unchanged.
- **British English spelling.** English cleanup defaults to spellings such as colour, organise, centre and paediatric. Choose Original / US English in Settings to retain recognised spellings. Verbatim mode, code, literal quotes, URLs, personal dictionary replacements and snippets preserve their text. This is spelling normalisation, not an accent model.
- **Corrections reach background sessions.** Settled short corrections to recently inserted dictation can reach the dictionary without reopening the main app. Imports acknowledge the native queue only after successful database writes. The next local capture can also use queued target words as hints.
- **Short phrase corrections.** Learning handles examples such as `new castle` → `Newcastle` and `worse ter` → `Worcester`. It rejects obvious changes to quantities/negations, appended text and unrelated multiword rewrites. The feature remains conservative; add a word manually when a correction is not learned.
- **Saved-audio fallback.** If the wider decoder produces an empty result, the recogniser releases it and retries the same samples with the original decoder. Normal dictation retry/history recovery remains available. You do not have to repeat the recording for this fallback.

## Use it

Keep **Parakeet**, **Accurate**, **British English** and **Smart cleanup** selected for a first test. Recognition and optional AI rewriting are separate stages. History retains the raw recognition so you can distinguish a speech error from an editing error.

Correct a saved transcript, or correct the inserted text in the same external field. External learning waits five seconds after an edit, watches for up to two minutes after insertion, and scopes changes to the inserted region where its boundaries can be identified. It is optional; turn off Learn spelling corrections to stop it, clear the active edit watch and clear pending imports. Personal dictionary entries remain editable/removable. Do not deliberately change facts or rewrite a whole sentence to teach spelling.

For a rare name/technical term that keeps failing, Dictionary supports an explicit spoken form and exact replacement. Target phrases, not source aliases or whole snippets, guide the recogniser. Hints are capped and sanitised; they influence recognition and cannot guarantee a word will be recovered when the acoustic evidence is poor.

## Validation and limits

Tests cover protected spellings/literals, conservative phrase learning, queue acknowledgement/failure behaviour, hint sanitation, settings persistence and segment boundaries. UI checks use fictional data and a simulated Android bridge.

Real INT8 model smoke checks used Sherpa-ONNX 1.13.8 on a Linux CPU, with a public JFK clip, six public VCTK clips and four Piper-generated British English phrases. These are small engineering checks, not a representative accent benchmark or Samsung S25 Ultra timing measurement. Five VCTK clips were recognised correctly by both decoders; the sixth exposed an empty beam-search result, motivating the same-audio fallback. Hard synthetic place/technical names still failed in both modes. Wider search did not demonstrate an overall word-error improvement on this sample, so it is used only with personal terms; the baseline remains available.

Sources: [VCTK-derived test set](https://huggingface.co/datasets/thelarryproject/vctk-normalized-asr), [Sherpa-ONNX JFK test clip](https://github.com/k2-fsa/sherpa-onnx/blob/v1.13.8/test_wavs/jfk.wav), [Piper Alba attribution](../MODEL-NOTICES.md). Speaker accent metadata was not verified for the VCTK subset. No user recordings were used or added to this repository.

There is no supported claim that general accuracy rose from 80% to a particular percentage, or that every recording finishes within five seconds. Before publishing, test the APK on your S25 Ultra using normal speech, pauses, names and longer dictations. Compare raw/final text, try both modes on the same saved audio, and check cancellation, retained recordings and correction learning. Keep sensitive recordings out of public issue reports.

## Tokenizer provenance

The attributed 121 KB BPE vocabulary is bundled with the APK. It is derived reproducibly from NVIDIA's pinned tokenizer and matches all 8,192 IDs in the pinned INT8 conversion. Run `node scripts/build-speech-vocabulary.mjs` to regenerate and verify its source/output checksums. See [MODEL-NOTICES.md](../MODEL-NOTICES.md).
