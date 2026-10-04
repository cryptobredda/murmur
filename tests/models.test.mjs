import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function moduleFromTypescript(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
  return import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'));
}
const models = await moduleFromTypescript('../src/types.ts');
const { assessDevice } = await moduleFromTypescript('../src/device.ts');

test('the catalog keeps Parakeet as default and adds experimental native Nemotron', () => {
  assert.deepEqual(models.speechModelOptions(), ['parakeet-v3', 'nemotron-multilingual', 'nemotron-en']);
  assert.deepEqual(models.editingModelOptions(), ['qwen3-native']);
  assert.equal(models.defaults.localModel, 'parakeet-v3');
  assert.equal(models.defaults.editingProvider, 'basic');
  assert.equal(models.defaults.voiceModel, 'none');
});
test('upgrades and imports retain the selected supported ASR and optional voice', () => {
  for(const localModel of models.speechModelOptions()) {
    const saved={localModel,language:'en',voiceModel:'piper-alba',onboardingComplete:true};
    const upgraded=models.normalizeSettings(saved);
    assert.equal(upgraded.localModel,localModel);
    assert.equal(upgraded.voiceModel,'piper-alba');
    assert.equal(upgraded.onboardingComplete,true);
    assert.deepEqual(models.normalizeSettings(upgraded),upgraded);
  }
  assert.equal(models.normalizeSettings({voiceModel:'unknown'}).voiceModel,'none');
});
test('Nemotron exposes ready languages and locales without unadapted languages', () => {
  assert.equal(models.languageOptions('local','nemotron-multilingual').length,33);
  assert.deepEqual(models.languageOptions('local','nemotron-en').map(([code])=>code),['auto','en']);
  for(const language of ['ar','ja','hi','tr','en-GB','fr-CA'])assert.ok(models.supportsSpeechLanguage('nemotron-multilingual',language));
  for(const language of ['el','he','th','sl'])assert.equal(models.supportsSpeechLanguage('nemotron-multilingual',language),false);
  assert.equal(models.normalizeSettings({localModel:'nemotron-multilingual',language:'ja'}).language,'ja');
  assert.equal(models.normalizeSettings({localModel:'nemotron-en',language:'ja'}).language,'auto');
});
test('upgrading retired models preserves setup, cloud options and personal preferences', () => {
  for (const localModel of ['tiny', 'base', 'small', 'moonshine-tiny', 'moonshine-small', 'moonshine-medium']) {
    for (const editingModel of ['compact', 'balanced', 'multilingual']) {
      const saved = { ...models.defaults, localModel, editingModel, onboardingComplete: true, overlayOpacity: 0.45,
        provider: 'custom', language: 'ar', cloudEndpoint: 'https://speech.example/v1', cloudModel: 'my-model',
        editingProvider: 'local', rememberKey: true, preferencesUpdatedAt: 123, profiles: [{ id: 'custom', name: 'My style' }] };
      const upgraded = models.normalizeSettings(saved);
      assert.equal(upgraded.localModel, 'parakeet-v3');
      assert.equal(upgraded.editingModel, 'qwen3-native');
      for (const key of ['onboardingComplete', 'overlayOpacity', 'provider', 'language', 'cloudEndpoint', 'cloudModel', 'editingProvider', 'rememberKey', 'preferencesUpdatedAt', 'profiles']) {
        assert.deepEqual(upgraded[key], saved[key]);
      }
      assert.equal(saved.localModel, localModel);
      assert.deepEqual(models.normalizeSettings(upgraded), upgraded);
    }
  }
});
test('local language choices match Parakeet and old unsupported choices become automatic', () => {
  const local = models.languageOptions('local');
  assert.equal(local.length, 26);
  assert.ok(local.some(([code]) => code === 'en'));
  assert.ok(!local.some(([code]) => code === 'ar'));
  assert.ok(models.languageOptions('custom').some(([code]) => code === 'ar'));
  assert.equal(models.normalizeSettings({ language: 'ar' }).language, 'auto');
  assert.equal(models.normalizeSettings({ language: 'fr' }).language, 'fr');
});
test('hardware recommendations do not block compatible phones and account for reserved memory', () => {
  const GiB = 2 ** 30;
  const s25 = { sdk: 36, arm64: true, ramBytes: 11 * GiB };
  assert.equal(assessDevice(s25, true).recommendedRam, true);
  assert.equal(assessDevice({ sdk: 26, arm64: true, ramBytes: 4 * GiB }, false).compatible, true);
  assert.equal(assessDevice({ sdk: 25, arm64: true, ramBytes: 12 * GiB }, true).compatible, false);
  assert.equal(assessDevice({ sdk: 36, arm64: false, ramBytes: 12 * GiB }, true).compatible, false);
  assert.equal(assessDevice({ sdk: 35, arm64: true, ramBytes: 7.1 * GiB }, false).recommendedRam, true);
  assert.equal(assessDevice({ sdk: 35, arm64: true, ramBytes: 7.1 * GiB }, true).recommendedRam, false);
  assert.equal(assessDevice({ sdk: 32, arm64: true, ramBytes: 7.1 * GiB }, false).modernEditorSupport, false);
});
