export async function flushLearnedCorrections({native,words,put,enabled,makeId=()=>crypto.randomUUID(),now=Date.now}){
  if(!enabled)return [];
  const rows=JSON.parse(native?.pendingLearnedWords?.()??native?.takeLearnedWords?.()??"[]");
  if(!Array.isArray(rows))return [];
  const saved=[],ids=[];
  for(const term of rows){
    if(typeof term?.id==="string")ids.push(term.id);
    if(typeof term?.spoken!=="string"||typeof term?.replacement!=="string"||!term.spoken.trim()||!term.replacement.trim()||term.spoken.length>100||term.replacement.length>100)continue;
    const existing=[...saved,...words].find(word=>word.spoken.toLowerCase()===term.spoken.toLowerCase());
    const word={id:existing?.id||makeId(),spoken:term.spoken,replacement:term.replacement,updatedAt:now()};
    await put(word);saved.push(word);
  }
  // An interrupted/failed write leaves the native queue for the next attempt.
  if(ids.length)native?.acknowledgeLearnedWords?.(JSON.stringify(ids));
  return saved;
}
