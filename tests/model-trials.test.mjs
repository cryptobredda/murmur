import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { wordErrorRate } from '../src/model-trials.mjs';

test('word errors distinguish substitution, deletion and insertion',()=>{
  assert.deepEqual(wordErrorRate('one two three','one too three'),{edits:1,referenceWords:3,rate:1/3});
  assert.equal(wordErrorRate('one two three','one three').rate,1/3);
  assert.equal(wordErrorRate('one','one two three').rate,2);
  assert.equal(wordErrorRate('one two','').rate,1);
});
test('word errors normalize Unicode and punctuation but require an independent reference',()=>{
  assert.equal(wordErrorRate('Café, mañana!','cafe\u0301 mañana').rate,0);
  assert.equal(wordErrorRate('Hello WORLD.','hello world').rate,0);
  assert.equal(wordErrorRate(' ... ','invented words'),null);
  assert.equal(wordErrorRate('مَرْحَبًا', 'مَرْحَبًا').referenceWords,1);
});
test('download catalog pins every file, including the English phonemizer data',async()=>{
  const catalog=JSON.parse(await readFile(new URL('../android/app/src/main/assets/native-models.json',import.meta.url),'utf8'));
  for(const spec of Object.values(catalog))for(const file of spec.files){
    assert.equal(file.checksum_type,'sha256');assert.match(file.checksum,/^[a-f0-9]{64}$/);
    assert.ok(file.size>0);assert.match(file.url,/^https:\/\/huggingface\.co\/.+\/resolve\/[a-f0-9]{40}\//);
    assert.ok(!file.name.split('/').some(part=>part==='.'||part==='..'));
  }
  assert.equal(catalog['nemotron-multilingual'].files[0].size,742090464);
  assert.equal(catalog['nemotron-en'].files[0].size,699872960);
  const voice=catalog['piper-alba'].files;
  assert.ok(voice.some(file=>file.name==='espeak-ng-data/lang/gmw/en-GB-x-rp'));
  assert.ok(voice.reduce((sum,file)=>sum+file.size,0)<65000000);
});
test('Ultra uses a separate pinned Parakeet bundle with a shared tokenizer and its own weights',async()=>{
  const catalog=JSON.parse(await readFile(new URL('../android/app/src/main/assets/native-models.json',import.meta.url),'utf8'));
  const ultra=catalog['parakeet-ultra'],original=catalog['parakeet-v3'];
  assert.equal(ultra.engine,'parakeet');assert.equal(ultra.license,'CC-BY-4.0');
  assert.equal(ultra.source,'https://huggingface.co/moondream/parakeet-ultra');
  assert.equal(ultra.conversion_revision,'b86784a3a5356cbd126f710b61cd90c5fe5898f1');
  assert.deepEqual(ultra.files.map(file=>file.name),original.files.map(file=>file.name));
  assert.equal(ultra.files.reduce((sum,file)=>sum+file.size,0),670576838);
  for(const file of ultra.files){
    const prior=original.files.find(other=>other.name===file.name);
    if(file.name==='tokens.txt')assert.equal(file.checksum,prior.checksum);
    else assert.notEqual(file.checksum,prior.checksum);
    assert.ok(file.url.includes('/'+ultra.conversion_revision+'/'));
  }
});
