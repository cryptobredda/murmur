import test from 'node:test';
import assert from 'node:assert/strict';
import {formatText,numberedLists,validEditedText} from '../src/core.mjs';
const natural={style:'natural',correctSpeech:true,formatLists:true,voiceCommands:true,removeFillers:true};

test('ordinary negative instructions survive cleanup',()=>{
  for(const text of ['Do not book the hotel.','Please do not send the report.','It is not very good.'])assert.equal(formatText(text,natural),text);
  assert.equal(formatText('Meet on not Tuesday but Wednesday.',natural),'Meet on Wednesday.');
});
test('explicit points become a list without consuming amounts or decimals',()=>{
  const text='I have 3 points. Point one keep the meeting at 3 pm. Point two do not book the hotel. Point three keep version 0.1.';
  assert.equal(numberedLists(text),'I have 3 points.\n\n1. keep the meeting at 3 pm.\n2. do not book the hotel.\n3. keep version 0.1.');
  for(const text of ['I waited for one person and two buses.','I need a list of one plumber and two electricians.','The value is 0.1. Two decimal places are enough.'])assert.equal(numberedLists(text),text);
  assert.equal(numberedLists('First point apples. Second point bananas.'),'1. apples.\n2. bananas.');
});
test('automatic proofreading rejects missing facts, numbers, and moved negations',()=>{
  assert.equal(validEditedText('Keep 3 invoices and pay 3 bills.','Keep 3 invoices and pay bills.'),false);
  assert.equal(validEditedText('Do not book the hotel and reserve the cabin.','Book the hotel and do not reserve the cabin.'),false);
  assert.equal(validEditedText('Do not book the hotel.','Book the hotel.'),false);
  assert.equal(validEditedText('I am testing three points. Keep the meeting at 3 pm and send the report to Alex.','Keep the meeting at 3 pm and send the report to Alex.'),false);
  assert.equal(validEditedText("We won't book the hotel.",'We will not book the hotel.'),true);
  assert.equal(validEditedText('Keep the meeting at 3 pm and send the report to Alex','Keep the meeting at 3 pm, and send the report to Alex.'),true);
});
