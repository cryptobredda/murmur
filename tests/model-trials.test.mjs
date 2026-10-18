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
