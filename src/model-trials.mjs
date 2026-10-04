// Word error rate uses an independently supplied, exact reference transcript.
// Punctuation and case are ignored. Values above 100% are possible with insertions.
export function wordErrorRate(reference, hypothesis) {
  const words = value => String(value).normalize('NFKC').toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{M}\p{N}\s']/gu, ' ').trim().split(/\s+/u).filter(Boolean);
  const expected = words(reference), actual = words(hypothesis);
  if (!expected.length) return null;
  let previous = Array.from({ length: expected.length + 1 }, (_, index) => index);
  for (let row = 1; row <= actual.length; row++) {
    const current = [row];
    for (let column = 1; column <= expected.length; column++) {
      current[column] = Math.min(current[column - 1] + 1, previous[column] + 1,
        previous[column - 1] + (actual[row - 1] === expected[column - 1] ? 0 : 1));
    }
    previous = current;
  }
  return { edits: previous[expected.length], referenceWords: expected.length, rate: previous[expected.length] / expected.length };
}
