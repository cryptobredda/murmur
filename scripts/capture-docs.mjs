// Render the bundled interface with fictional data. This does not run native AI.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const images = new URL('../docs/images/', import.meta.url);
await mkdir(images, { recursive: true });
const reservation = createServer();
await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (preview.exitCode !== null) throw new Error('Preview exited before capture.');
    try { ready = (await fetch(origin)).ok; } catch {}
    if (ready) break;
    await delay(100);
  }
  if (!ready) throw new Error('Preview did not start. Run npm run build first.');
  browser = await chromium.launch({
    ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}),
    args: ['--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, reducedMotion: 'reduce', locale: 'en-GB' });
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await context.addInitScript(() => {
    const demo = window.murmurDemo = { cached: JSON.parse(localStorage.getItem('murmur-demo-cache') || '["parakeet-v3"]'), files: {}, jobs: {}, recording: false, clip: '', sequence: 0 };
    const job = value => { const id = `demo-${++demo.sequence}`; demo.jobs[id] = value; return id; };
    window.MurmurAndroid = {
      getLaunchContext: () => JSON.stringify({ version: '0.7.0-test' }),
      deviceInfo: () => JSON.stringify({ model: 'Android demo device', androidVersion: '16', sdk: 36, ramBytes: 12 * 2 ** 30, freeStorageBytes: 32e9, arm64: true, soc: 'Demo ARM64' }),
      accessibilityEnabled: () => true, configureOverlay: () => {}, configureOverlayAppearance: () => {}, overlayStatus: () => JSON.stringify({ pausedUntil: 0 }), resumeOverlay: () => {},
      backgroundBusy: () => false, pauseBackgroundEngine: () => {}, resumeBackgroundEngine: () => {},
      readSecret: () => '', writeSecret: () => true, configureSpeech: () => {}, copyText: () => true,
      nativeSpeechModels: () => JSON.stringify(demo.cached),
      prepareNativeSpeech: (model, cacheOnly) => {
        if (cacheOnly && !demo.cached.includes(model)) return job({ state: 'error', error: 'Model not downloaded.' });
        if (!demo.cached.includes(model)) demo.cached.push(model);
        localStorage.setItem('murmur-demo-cache', JSON.stringify(demo.cached));
        return job({ state: 'done', loaded: 670478772, total: 670478772 });
      },
      nativeSpeechStatus: id => JSON.stringify(demo.jobs[id] || { state: 'running' }),
      cancelNativeSpeech: id => { demo.jobs[id] = { state: 'error', error: 'Cancelled' }; },
      microphonePermission: () => 'granted',
      startNativeRecording: () => { demo.clip = 'demo-recording'; demo.recording = true; demo.files[demo.clip] = { id: demo.clip, createdAt: Date.now(), updatedAt: Date.now(), sampleRate: 16000, bytes: 384000, status: 'recording', attempts: 0 }; return true; },
      nativeRecordingStatus: () => JSON.stringify({ recording: demo.recording, ready: !!demo.clip, audioId: demo.clip, sampleRate: 16000, seconds: 12, level: .6 }),
      freezeNativeRecording: () => { demo.recording = false; demo.files[demo.clip].status = 'processing'; },
      cancelNativeRecording: () => { demo.recording = false; if (demo.clip) demo.files[demo.clip].status = 'saved'; },
      listNativeAudio: () => JSON.stringify(Object.values(demo.files)), nativeAudioInfo: id => JSON.stringify(demo.files[id] || {}),
      updateNativeAudio: (id, json) => { Object.assign(demo.files[id] || {}, JSON.parse(json)); return true; },
      beginSavedProcessing: () => true, completeAudioProcessing: () => {},
      transcribeNativeAudio: () => job({ state: 'running' }),
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const capture = async name => {
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: new URL(`${name}.png`, images).pathname, animations: 'disabled' });
  };
  await page.goto(origin);
  await page.getByRole('heading', { name: 'Your voice. Ready to go.' }).waitFor();
  await capture('onboarding');
  await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('murmur-local');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(['settings', 'history', 'words', 'snippets'], 'readwrite');
      transaction.objectStore('settings').put({ id: 'preferences', value: { provider: 'local', localModel: 'parakeet-v3', onboardingComplete: true, editingProvider: 'basic', editingModel: 'qwen3-native', autoCopy: true, overlayOpacity: 1 } });
      const now = Date.now();
      const rows = [
        { id: 'demo-note', text: 'Three ideas for the weekend:\n1. Visit the farmers market.\n2. Take a walk by the river.\n3. Make time for a good book.', duration: 24, starred: true },
        { id: 'demo-message', text: 'Hi Alex, could we move our meeting to Thursday at 3 pm? I will send the notes before we meet.', duration: 14, starred: false },
      ];
      rows.forEach((row, index) => {
        transaction.objectStore('history').put({ ...row, raw: row.text, createdAt: now - (index + 1) * 3600000, source: 'local', model: 'Parakeet TDT v3', style: 'natural', status: 'complete', audioId: row.id, editingModel: 'Smart cleanup' });
        window.murmurDemo.files[row.id] = { id: row.id, createdAt: now - (index + 1) * 3600000, updatedAt: now - (index + 1) * 3600000, sampleRate: 16000, bytes: row.duration * 32000, status: 'complete', text: row.text, raw: row.text, model: 'Parakeet TDT v3', editingModel: 'Smart cleanup' };
      });
      [{ id: 'demo-word-1', spoken: 'murmur', replacement: 'Murmur' }, { id: 'demo-word-2', spoken: 'para keet', replacement: 'Parakeet' }].forEach(row => transaction.objectStore('words').put(row));
      transaction.objectStore('snippets').put({ id: 'demo-snippet', phrase: 'my sign off', text: 'Thanks, and have a lovely day.' });
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
    };
  }));
  await page.reload();
  await page.getByRole('button', { name: 'Start dictating', exact: true }).waitFor();
  await capture('dictate');
  for (const [label, name] of [['History', 'history'], ['Dictionary', 'dictionary'], ['Settings', 'settings']]) {
    await page.getByRole('button', { name: label, exact: true }).first().click();
    await capture(name);
  }
  // Show the actual in-app download entry before the speech model is installed.
  await page.evaluate(() => { localStorage.setItem('murmur-demo-cache', '[]'); });
  await page.reload();
  await page.getByRole('button', { name: 'Models', exact: true }).first().click();
  await page.locator('.model-card').waitFor();
  await capture('models');
  await page.locator('.model-card').getByRole('button', { name: /Download/ }).click();
  await page.locator('.model-card').getByRole('button', { name: 'Ready', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Dictate', exact: true }).first().click();
  await page.getByRole('textbox', { name: 'Dictation editor' }).focus();
  const dock = page.locator('.floating-dock');
  await dock.waitFor();
  await dock.screenshot({ path: new URL('floating-idle.png', images).pathname, animations: 'disabled', omitBackground: true });
  await dock.getByRole('button', { name: 'Dictate into focused text field', exact: true }).click();
  await dock.locator('.floating-wave').waitFor();
  await dock.screenshot({ path: new URL('floating-listening.png', images).pathname, animations: 'disabled', omitBackground: true });
  await dock.getByRole('button', { name: 'Finish dictation into text field', exact: true }).click();
  await dock.locator('.spin').waitFor();
  await dock.screenshot({ path: new URL('floating-processing.png', images).pathname, animations: 'disabled', omitBackground: true });
  await dock.getByRole('button', { name: 'Cancel floating dictation', exact: true }).click();
  if (errors.length) throw new Error(`UI errors: ${errors.join('; ')}`);
  console.log('Captured six app screens and three floating-control previews using fictional data.');
} finally {
  await browser?.close();
  preview.kill('SIGTERM');
}
