import test from 'node:test';
import assert from 'node:assert/strict';
import {britishSpelling,formatText,learnCorrection} from '../src/core.mjs';
import {flushLearnedCorrections} from '../src/learning.mjs';

test('British spelling is selective and protects identifiers, literals and personal terms',()=>{
  assert.equal(britishSpelling('Our favorite color is gray. We organized the theater visit.'),'Our favourite colour is grey. We organised the theatre visit.');
  const technical='Use `color`, api.color and "favorite" at https://color.example/color. Email color@example.org.';
  assert.equal(britishSpelling(technical),technical);
  const settings={style:'natural',language:'en-GB',englishVariant:'en-GB',removeFillers:false,voiceCommands:false,correctSpeech:false,formatLists:false};
  assert.equal(formatText('My favorite color is gray.',settings,[{spoken:'color',replacement:'Color'}]),'My favourite Color is grey.');
  assert.equal(formatText('My favorite color is gray.',{...settings,style:'verbatim'}),'My favorite color is gray.');
  assert.equal(formatText('My favorite color is gray.',{...settings,codeMode:true}),'My favorite color is gray.');
  assert.equal(formatText('El color favorito es azul.',{...settings,language:'es'}),'El color favorito es azul.');
});
test('learning handles split names and phrases while rejecting appended typing or changed facts',()=>{
  assert.deepEqual(learnCorrection('Send it to new castle today.','Send it to Newcastle today.'),{spoken:'new castle',replacement:'Newcastle'});
  assert.deepEqual(learnCorrection('Add worse ter sauce.','Add Worcester sauce.'),{spoken:'worse ter',replacement:'Worcester'});
  assert.deepEqual(learnCorrection('Visit Leister tomorrow.','Visit Leicester tomorrow.'),{spoken:'Leister',replacement:'Leicester'});
  for(const pair of [['Visit Leicester.','Visit Leicester today.'],['visit leicester','visit Leicester OK'],['It is good.','It is bad.'],["We can’t go.",'We can go.'],['Dose ٢٣ today.','Dose ٢٤ today.'],['Version Q3 R4','Version Q34 R'],['Use color = 1;','Use colour = 1;']])assert.equal(learnCorrection(...pair),null,pair.join(' → '));
});
test('native corrections are acknowledged only after every dictionary write succeeds',async()=>{
  const rows=[{id:'queue-1',spoken:'Leister',replacement:'Leicester'},{id:'queue-2',spoken:'new castle',replacement:'Newcastle'}],events=[];
  const native={pendingLearnedWords:()=>JSON.stringify(rows),acknowledgeLearnedWords:ids=>events.push(['ack',JSON.parse(ids)])};
  await assert.rejects(flushLearnedCorrections({native,words:[],enabled:true,makeId:()=> 'word',put:async()=>{throw new Error('Storage full');}}),/Storage full/);
  assert.deepEqual(events,[]);
  const saved=await flushLearnedCorrections({native,words:[{id:'existing',spoken:'Leister',replacement:'Leister'}],enabled:true,makeId:()=> 'new-word',now:()=>1,put:async word=>events.push(['put',word.id])});
  assert.deepEqual(events,[['put','existing'],['put','new-word'],['ack',['queue-1','queue-2']]]);assert.equal(saved[0].replacement,'Leicester');
  events.length=0;await flushLearnedCorrections({native,words:[],enabled:false,put:async()=>assert.fail('Learning disabled')});assert.deepEqual(events,[]);
});
