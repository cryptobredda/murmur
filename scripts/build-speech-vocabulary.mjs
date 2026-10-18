import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

// Developer-only reproducible conversion. End users receive the vocabulary inside the APK.
const url='https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3/resolve/541d1f99c6b0c3cd0b11a95167540bb8edefd82b/tokenizer.json';
// curl honours the build environment's proxy and CA configuration.
const bytes=execFileSync('curl',['--fail','--location','--silent','--show-error',url],{maxBuffer:4*1024*1024});
if(createHash('sha256').update(bytes).digest('hex')!=='bd321b096832a3f270bd3b2a88823957920f1a5c5ada71114a26ea729d0cbe91')throw new Error('Tokenizer checksum mismatch.');
const {model}=JSON.parse(bytes);if(model.type!=='BPE'||Object.keys(model.vocab).length!==8192)throw new Error('Unexpected tokenizer format.');
const scores=new Map();model.merges.forEach((pair,rank)=>{const piece=Array.isArray(pair)?pair.join(''):pair.split(' ').join('');if(!scores.has(piece))scores.set(piece,-rank);});
const vocabulary=Object.entries(model.vocab).sort((a,b)=>a[1]-b[1]).map(([piece])=>`${piece}\t${Object.is(scores.get(piece),-0)?'-0.0':(scores.get(piece)??-20000).toFixed(1)}`).join('\n')+'\n';
const digest=createHash('sha256').update(vocabulary).digest('hex');
if(digest!=='734291878abbba0ac4117e5cc50798bf19077917cc5609102e5037f497a4d447')throw new Error('Converted vocabulary differs from the pinned asset.');
await writeFile(new URL('../android/app/src/main/assets/speech/parakeet-v3.vocab',import.meta.url),vocabulary);
console.log('Prepared 8192 attributed Parakeet BPE pieces with verified source and output checksums.');
