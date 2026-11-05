"""Developer smoke check; end users download models inside Murmur.

Requires sherpa-onnx==1.13.8, numpy and soundfile. No model Python code is loaded.
This checks the pinned export on the host CPU, not Android latency/accent accuracy.
"""
import argparse
import gc
import hashlib
import json
from pathlib import Path
import re
import time

import numpy as np
import sherpa_onnx
import soundfile as sf


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-dir", type=Path, required=True)
    parser.add_argument("--audio", type=Path, required=True)
    parser.add_argument("--reference")
    parser.add_argument("--hint", action="append", required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    catalog = json.loads((root / "android/app/src/main/assets/native-models.json").read_text())
    spec = catalog["parakeet-ultra"]
    assert sherpa_onnx.__version__ == "1.13.8", "Use the same runtime version as the Android app."
    verified = []
    for file in spec["files"]:
        path = args.model_dir / file["name"]
        with path.open("rb") as stream:
            digest = hashlib.file_digest(stream, "sha256").hexdigest()
        assert path.stat().st_size == file["size"] and digest == file["checksum"], path
        verified.append(file["name"])
    hints = list(dict.fromkeys(term for hint in args.hint for term in (hint, hint.lower())))
    assert all(term and not re.search(r"[/\n\r:]", term) for term in hints)
    samples, rate = sf.read(args.audio, dtype="float32")
    assert samples.ndim == 1 and len(samples), "Provide nonempty mono audio."
    audio = np.pad(samples, (0, round(rate * .3)))
    results = []
    for method in ["greedy_search", "modified_beam_search"]:
        options = {}
        if method == "modified_beam_search":
            options = dict(modeling_unit="bpe", bpe_vocab=str(root / "android/app/src/main/assets/speech/parakeet-v3.vocab"), hotwords_score=.8)
        start = time.perf_counter()
        recognizer = sherpa_onnx.OfflineRecognizer.from_transducer(
            encoder=str(args.model_dir / "encoder.int8.onnx"), decoder=str(args.model_dir / "decoder.int8.onnx"),
            joiner=str(args.model_dir / "joiner.int8.onnx"), tokens=str(args.model_dir / "tokens.txt"),
            model_type="nemo_transducer", num_threads=4, decoding_method=method, max_active_paths=4, **options)
        loaded = time.perf_counter()
        stream = recognizer.create_stream("/".join(hints)) if options else recognizer.create_stream()
        stream.accept_waveform(rate, audio)
        recognizer.decode_stream(stream)
        finished = time.perf_counter()
        text = stream.result.text
        assert text.strip(), f"Empty {method} result."
        result = dict(method=method, text=text, loadSeconds=loaded-start, decodeSeconds=finished-loaded)
        if args.reference is not None:
            words = lambda value: re.findall(r"\w+", value.casefold())
            result["referenceMatch"] = words(text) == words(args.reference)
            assert result["referenceMatch"], result
        results.append(result)
        del stream, recognizer
        gc.collect()
    print(json.dumps(dict(model="parakeet-ultra", revision=spec["conversion_revision"], runtime=sherpa_onnx.__version__,
                         audioSeconds=len(samples)/rate, verifiedFiles=verified, results=results,
                         scope="Host CPU smoke check; not a phone performance/accent benchmark."), indent=2))


if __name__ == "__main__":
    main()
