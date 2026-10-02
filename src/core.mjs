export function resample(input, from, to = 16000) {
  if (from === to) return input;
  const count = Math.floor((input.length * to) / from),
    result = new Float32Array(count),
    ratio = from / to;
  for (let i = 0; i < count; i++) {
    const start = Math.floor(i * ratio),
      end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let total = 0;
    for (let j = start; j < end; j++) total += input[j];
    result[i] = end > start ? total / (end - start) : input[start] || 0;
  }
  return result;
}
export function wavBytes(pcm, sampleRate = 16000) {
  const result = new ArrayBuffer(44 + pcm.length * 2),
    v = new DataView(result);
  const str = (offset, s) => {
    for (let i = 0; i < s.length; i++) v.setUint8(offset + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  v.setUint32(4, 36 + pcm.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const n = Math.max(-1, Math.min(1, pcm[i]));
    v.setInt16(44 + i * 2, n < 0 ? n * 32768 : n * 32767, true);
  }
  return result;
}
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function replacePhrase(text, phrase, replacement) {
  if (!phrase.trim()) return text;
  return text.replace(
    new RegExp(
      "(?<![\\p{L}\\p{N}_])" + escape(phrase.trim()) + "(?![\\p{L}\\p{N}_])",
      "giu",
    ),
    () => replacement,
  );
}
export function formatText(raw, settings, words = [], snippets = []) {
  let text = raw.trim();
  if (settings.style === "verbatim") return text;
  const protectedSnippets = [];
  for (const s of [...snippets].sort(
    (a, b) => b.phrase.length - a.phrase.length,
  )) {
    const token = "\ue000" + protectedSnippets.length + "\ue001";
    protectedSnippets.push(s.text);
    text = replacePhrase(text, s.phrase, token);
  }
  if (settings.correctSpeech) text = resolveCorrections(text);
  for (const w of [...words].sort(
    (a, b) => b.spoken.length - a.spoken.length,
  )) {
    const token = "\ue000" + protectedSnippets.length + "\ue001";
    protectedSnippets.push(w.replacement);
    text = replacePhrase(text, w.spoken, token);
  }
  if (settings.voiceCommands) {
    const commands = [
      ["new paragraph", "\n\n"],
      ["new line", "\n"],
      ["open parenthesis", "("],
      ["close parenthesis", ")"],
      ["open parentheses", "("],
      ["close parentheses", ")"],
      ["open bracket", "["],
      ["close bracket", "]"],
      ["open quote", "“"],
      ["close quote", "”"],
      ["comma", ","],
      ["full stop", "."],
      ["question mark", "?"],
      ["exclamation mark", "!"],
      ["colon", ":"],
      ["semicolon", ";"],
    ];
    for (const [phrase, replacement] of commands)
      text = replacePhrase(text, phrase, replacement);
  }
  if (settings.removeFillers) {
    text = text
      .replace(/(^|[\s,.])(?:um+|uh+|erm+|hmm+)(?=$|[\s,.])/gi, "$1")
      .replace(/(^|\s)(?:you know|I mean)(?:,)?(?=\s|$)/gi, "$1");
  }
  if (settings.formatLists) text = numberedLists(text);
  text = text
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/ +([,.!?:;\)\]])/g, "$1")
    .replace(/([\(\[]) +/g, "$1")
    .replace(/^[\s,;]+/, "")
    .trim();
  if (!settings.codeMode)
    text = text.replace(
      /(^|[.!?]\s+|\n)(\p{L})/gu,
      (_, a, b) => a + b.toLocaleUpperCase(),
    );
  if (settings.tone && !settings.codeMode)
    text = applyTone(text, settings.tone);
  text = text.replace(
    /\ue000(\d+)\ue001/g,
    (_, index) => protectedSnippets[Number(index)] ?? "",
  );
  if (settings.style === "polished" && text && !/[.!?。！？]$/.test(text))
    text += ".";
  return text;
}
export function wordCount(text) {
  return text.trim() ? text.trim().split(/\s+/u).length : 0;
}
export function validateEndpoint(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a complete transcription endpoint URL.");
  }
  if (url.username || url.password || url.hash)
    throw new Error("Use an endpoint without credentials or a URL fragment.");
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
  )
    throw new Error("Use an HTTPS endpoint, or HTTP on localhost.");
  return url.href;
}
export function validateBackup(data) {
  if (
    !data ||
    data.app !== "murmur" ||
    data.version !== 1 ||
    !Array.isArray(data.transcripts) ||
    data.transcripts.length > 10000
  )
    throw new Error("This is not a supported Murmur backup.");
  const ids = new Set();
  for (const t of data.transcripts) {
    if (
      typeof t.id !== "string" ||
      ids.has(t.id) ||
      typeof t.text !== "string" ||
      t.text.length > 1000000 ||
      typeof t.raw !== "string" ||
      !Number.isFinite(t.createdAt) ||
      !Number.isFinite(t.duration) ||
      t.duration < 0 ||
      !["local", "openai", "groq", "custom"].includes(t.source) ||
      typeof t.model !== "string" ||
      !["natural", "polished", "verbatim"].includes(t.style) ||
      typeof t.starred !== "boolean"
    )
      throw new Error("The backup contains an invalid dictation.");
    ids.add(t.id);
  }
  for (const [key, a, b] of [
    ["words", "spoken", "replacement"],
    ["snippets", "phrase", "text"],
  ]) {
    if (
      !Array.isArray(data[key]) ||
      data[key].length > 10000 ||
      data[key].some(
        (w) =>
          typeof w.id !== "string" ||
          typeof w[a] !== "string" ||
          !w[a].trim() ||
          typeof w[b] !== "string" ||
          !w[b].trim() ||
          w[a].length > 10000 ||
          w[b].length > 100000,
      )
    )
      throw new Error("The backup contains invalid vocabulary.");
  }
  return data;
}

// Conservative, explicit backtracking: a correction must immediately follow its old value.
export function resolveCorrections(text) {
  const time =
    "(?:[0-9]+(?::[0-9]{2})?(?:\\s*(?:a\\.?m\\.?|p\\.?m\\.?))?|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December|one|two|three|four|five|six|seven|eight|nine|ten)";
  text = text.replace(
    new RegExp(
      "\\b(" +
        time +
        ")[ ,.…-]*(?:actually|sorry|no wait|I mean|rather|make that)[ ,.…-]*(" +
        time +
        ")\\b",
      "gi",
    ),
    (_, a, b) => b,
  );
  text = text.replace(
    /\b([\p{L}]{2,}),\s*(?:actually|sorry|no wait|make that)\s+([\p{L}]{2,})\b/giu,
    "$2",
  );
  text = text.replace(
    /\bnot\s+([\p{L}\p{N}]+),?\s+but\s+([\p{L}\p{N}]+)(?=[.!?,]|$)/giu,
    "$2",
  );
  // An explicit restart replaces a complete earlier clause, never an arbitrary word.
  text = text.replace(
    /(^|[.!?]\s+)([^.!?\n]+?)[,…]\s*(?:scratch that|let me start over)[, .…]*(.+?)(?=[.!?]|$)/gi,
    (_, prefix, old, replacement) => prefix + replacement,
  );
  return text;
}
export function numberedLists(text) {
  const numbers = {one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,first:1,second:2,third:3,fourth:4,fifth:5,sixth:6,seventh:7,eighth:8,ninth:9,tenth:10};
  // Explicit labels and already punctuated list markers cannot consume amounts,
  // decimal values, or times mentioned inside an item.
  const markers = /\b(?:number|point|item|step)\s+(one|two|three|four|five|six|seven|eight|nine|ten|10|[1-9])[.:),]?\s+(?=\S)|\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+(?:point|item|step)[,:.]?\s+(?=\S)|(?<![\d.])\b(10|[1-9])[.)]\s+(?=\S)/gi;
  const series=[];let expected=1;
  for(const match of text.matchAll(markers)) {
    const word=(match[1]||match[2]||match[3]).toLowerCase(),n=numbers[word]||Number(word);
    if(n===expected){series.push(match);expected++;}
    else if(series.length)break;
  }
  if(series.length<2)return text;
  const prefix=text.slice(0,series[0].index).trim();
  const rows=series.map((match,i)=>`${i+1}. ${text.slice(match.index+match[0].length,series[i+1]?.index??text.length).trim().replace(/[,;]+$/,"")}`);
  return (prefix?(/[.!?]$/.test(prefix)?prefix+"\n\n":prefix.replace(/[,:;]$/,"")+":\n"):"")+rows.join("\n");
}

export function learnCorrection(before, after) {
  const a = before.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || [];
  const b = after.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || [];
  if (a.length !== b.length) return null;
  const changes = a
    .map((value, i) => ({ spoken: value, replacement: b[i] }))
    .filter((x) => x.spoken !== x.replacement);
  if (
    changes.length !== 1 ||
    changes[0].spoken.length < 2 ||
    changes[0].replacement.length < 2
  )
    return null;
  return changes[0];
}
export function chooseProfile(profiles, packageName) {
  if (!packageName) return null;
  const name = packageName.toLowerCase();
  return (
    profiles.find((p) =>
      p.packages
        .split(",")
        .map((x) => x.trim().toLowerCase())
        .some((x) => x && name.includes(x)),
    ) || null
  );
}
export function codeFormat(text) {
  const convert = (s, kind) => {
    const terms = s.trim().split(/\s+/);
    return kind === "snake"
      ? terms.map((x) => x.toLowerCase()).join("_")
      : kind === "kebab"
        ? terms.map((x) => x.toLowerCase()).join("-")
        : terms
            .map((x, i) =>
              i ? x[0].toUpperCase() + x.slice(1) : x.toLowerCase(),
            )
            .join("");
  };
  return text
    .replace(
      /\b(camel|snake|kebab) case\s+([\p{L}]+(?:\s+[\p{L}]+){0,3}?)(?=\s+(?:comma|equals|open|close|new)|[,;\n]|$)/giu,
      (_, kind, phrase) => convert(phrase, kind.toLowerCase()),
    )
    .replace(/\btag file\s+([\w./-]+)/gi, "@$1")
    .replace(/\bdouble equals\b/gi, "==")
    .replace(/\bequals\b/gi, "=")
    .replace(/\bopen brace\b/gi, "{")
    .replace(/\bclose brace\b/gi, "}")
    .replace(/\bbacktick\b/gi, "`");
}
export function applyTone(text, tone) {
  if (tone === "very-casual")
    return text.toLocaleLowerCase().replace(/\.$/, "");
  if (tone === "casual")
    return text
      .replace(/\bI am\b/g, "I'm")
      .replace(/\bI will\b/g, "I'll")
      .replace(/\bdo not\b/gi, "don't");
  if (tone === "formal")
    return text
      .replace(/\bI'm\b/g, "I am")
      .replace(/\bI'll\b/g, "I will")
      .replace(/\bdon't\b/gi, "do not");
  return text;
}
export function validEditedText(original, candidate, protectedTerms = []) {
  if (
    typeof candidate !== "string" ||
    !candidate.trim() ||
    candidate.length > Math.max(600, original.length * 2.5)
  )
    return false;
  if (
    /(?:<\|(?:im_|end|assistant)|As an AI|I (?:am pleased|can (?:help|assist)|will (?:provide|help))|Please (?:feel free|provide|share)|Here is (?:the|your) (?:rewritten|corrected)|\[INST\])/i.test(
      candidate,
    )
  )
    return false;
  // Automatic cleanup should retain the words that carry the dictation's meaning.
  // Small models sometimes produce a polite assistant reply instead of editing.
  const normalized=(value)=>value.toLocaleLowerCase().replace(/[’]/g,"'")
    .replace(/\b(?:can't|cannot)\b/g,"can not").replace(/\bwon't\b/g,"will not").replace(/n't\b/g," not")
    .replace(/\b(we|you|they)'re\b/g,"$1 are").replace(/\b(i|we|you|they)'ve\b/g,"$1 have").replace(/\bi'm\b/g,"i am").replace(/\b(i|we|you|they)'ll\b/g,"$1 will");
  const tokens = (value) =>
    (normalized(value).match(/[\p{L}\p{N}]+/gu) || []).flatMap(
      (word) =>
        /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u.test(
          word,
        )
          ? Array.from(word)
          : word,
    );
  const source = [
    ...new Set(
      tokens(original).filter(
        (word) => word.length > 2 || /[^\p{Script=Latin}]/u.test(word),
      ),
    ),
  ];
  const output = new Set(tokens(candidate));
  if (
    source.length &&
    source.filter((word) => output.has(word)).length / source.length < 0.9
  )
    return false;
  const numbers = original.match(/\d+(?:[.,:]\d+)*/g) || [];
  const added = candidate.match(/\d+(?:[.,:]\d+)*/g) || [];
  const counts=(values)=>values.reduce((result,value)=>{result.set(value,(result.get(value)||0)+1);return result;},new Map());
  const sourceNumbers=counts(numbers),outputNumbers=counts(added);
  if(sourceNumbers.size!==outputNumbers.size || [...sourceNumbers].some(([value,count])=>outputNumbers.get(value)!==count))return false;
  const negationWords=["no","not","never","without","except"];
  const negations=(text)=>counts(tokens(text).filter(word=>negationWords.includes(word)));
  const sourceNegations=negations(original),outputNegations=negations(candidate);
  if(sourceNegations.size!==outputNegations.size || [...sourceNegations].some(([word,count])=>outputNegations.get(word)!==count))return false;
  const negationAnchors=(text)=>{const words=tokens(text);return words.flatMap((word,i)=>negationWords.includes(word)?[word+":"+words.slice(i+1).filter(next=>!["a","an","the","to","be","is","are"].includes(next)).slice(0,2).join(" ")]:[]);};
  if(JSON.stringify(negationAnchors(original))!==JSON.stringify(negationAnchors(candidate)))return false;
  const sourceWords=new Set(tokens(original));
  const outputWords=tokens(candidate).filter(word=>word.length>2);
  if(outputWords.length&&outputWords.filter(word=>!sourceWords.has(word)).length/outputWords.length>.12)return false;
  for (const term of protectedTerms) {
    if (original.includes(term) && !candidate.includes(term)) return false;
  }
  return true;
}
