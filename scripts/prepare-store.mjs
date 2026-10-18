import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const store=path.join(root,'store'),listing=JSON.parse(await readFile(path.join(store,'listing.json'),'utf8'));
const play=path.join(store,'google-play/metadata/en-GB'),apple=path.join(store,'apple/drafts/en-GB');
await mkdir(path.join(play,'images/phoneScreenshots'),{recursive:true});await mkdir(apple,{recursive:true});
for(const [file,key] of [['title','title'],['short_description','shortDescription'],['full_description','fullDescription']])await writeFile(path.join(play,file+'.txt'),listing.googlePlay[key]+'\n');
await writeFile(path.join(play,'release_notes.txt'),'0.9.0: Accurate word search with personal vocabulary, British English spelling, short phrase corrections and reliable background learning. Saved recordings remain reusable. Updated Android API 36 release configuration.\n');
await writeFile(path.join(play,'contact-email.txt'),listing.supportEmail+'\n');await writeFile(path.join(play,'privacy-policy-url.txt'),listing.privacyPolicyUrl+'\n');
for(const [file,key] of [['name','name'],['subtitle','subtitle'],['promotional_text','promotionalText'],['keywords','keywords'],['description','description']])await writeFile(path.join(apple,file+'.txt'),listing.appleDraft[key]+'\n');
const capture=spawnSync(process.execPath,['scripts/capture-docs.mjs'],{cwd:root,env:{...process.env,MURMUR_CAPTURE_DIR:path.join(store,'source-screens')},stdio:'inherit'});
if(capture.status!==0)throw new Error('Production UI capture failed.');
const sans=await readFile(path.join(root,'public/fonts/dm-sans.woff2')),head=await readFile(path.join(root,'public/fonts/manrope.woff2'));
const css=`@font-face{font-family:DM;src:url(data:font/woff2;base64,${sans.toString('base64')})}@font-face{font-family:Manrope;src:url(data:font/woff2;base64,${head.toString('base64')})}*{box-sizing:border-box}body{margin:0;background:#f8f7ed;color:#1d5144;font-family:DM,sans-serif}h1,h2,.wordmark{font-family:Manrope,sans-serif}h1{font-weight:760;letter-spacing:-3px}.wordmark{font-weight:850;letter-spacing:-2px}.dot{color:#d38160}img{display:block}`;
const icon=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#286557"/><g stroke="#eef5e9" stroke-width="6" stroke-linecap="round"><path d="M16 27v10M27 17v30M38 23v18M49 28v8"/></g></svg>`;
const wave=`<svg viewBox="0 0 1080 500" style="position:absolute;inset:0;width:100%;height:100%;opacity:.18"><path d="M380 370C600 460 650 20 850 155S1050 410 1200 50" fill="none" stroke="#6a9e85" stroke-width="90"/><path d="M430 410C630 420 690 80 860 200S1080 400 1200 160" fill="none" stroke="#d38160" stroke-width="2"/></svg>`;
const browser=await chromium.launch({...process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{},args:['--disable-dev-shm-usage']});
try{
 const page=await browser.newPage({deviceScaleFactor:1});
 async function render(width,height,html,destination){await page.setViewportSize({width,height});await page.setContent(`<html><head><style>${css}</style></head><body>${html}</body></html>`);await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:destination,omitBackground:false,animations:'disabled'});}
 await render(512,512,icon,path.join(play,'images/icon.png'));
 await render(1024,1024,icon,path.join(store,'apple/drafts/AppIcon-1024.png'));
 await render(1024,500,`${wave}<div style="position:absolute;left:64px;top:116px"><div class="wordmark" style="font-size:90px;line-height:1">murmur<span class="dot">.</span></div><h2 style="font-size:34px;letter-spacing:-1px;margin:20px 0 12px">Less typing. More you.</h2><div style="font-size:22px">Free, offline voice typing for Android</div></div><div style="position:absolute;right:66px;top:130px;width:210px;height:210px;border-radius:48px;overflow:hidden">${icon}</div>`,path.join(play,'images/featureGraphic.png'));
 const panels=[
 ['01-speak','dictate','Talk naturally.<br>Keep moving.','Local speech. Your existing keyboard.'],
 ['02-your-words','dictionary','British English.<br>Your own words.','Your dictionary helps recognition learn your terms.'],
 ['03-history','history','Every thought,<br>kept close.','Save, find and reprocess your recordings.'],
 ['04-floating','floating-context','Small control.<br>Less reaching.','A compact floating control for supported text fields.'],
 ['05-control','accuracy','Free to speak.<br>Yours to keep.','Choose recognition accuracy and English spelling.'],
 ];
 for(const [name,screen,title,subtitle] of panels){
  const bytes=await readFile(path.join(store,'source-screens',screen+'.png'));const src='data:image/png;base64,'+bytes.toString('base64');
  const extra=name==='04-floating'?`<div style="position:absolute;right:80px;top:850px;background:#eaf0e4;border:2px solid #c9d8c8;border-radius:28px;padding:26px;box-shadow:0 12px 40px #123d3020"><img style="width:200px" src="data:image/png;base64,${(await readFile(path.join(store,'source-screens/floating-listening.png'))).toString('base64')}"><p style="font-size:17px;margin:14px 0 0;text-align:center">Floating control preview</p></div>`:'';
  await render(1080,1920,`<div style="position:absolute;width:800px;height:800px;border-radius:50%;background:#e4ecdf;left:-300px;top:920px"></div><div class="wordmark" style="position:absolute;left:86px;top:54px;font-size:38px">murmur<span class="dot">.</span></div><h1 style="position:absolute;left:86px;top:120px;font-size:76px;line-height:1.08;margin:0">${title}</h1><p style="position:absolute;left:88px;top:303px;font-size:25px;color:#587063;margin:0">${subtitle}</p><div style="position:absolute;left:194px;top:405px;width:692px;height:1460px;border:13px solid #234c40;border-radius:54px;overflow:hidden;box-shadow:0 30px 70px #254d4020;background:#fcfdfb"><img src="${src}" style="width:100%;height:100%;object-fit:cover;object-position:top"></div>${extra}<div style="position:absolute;right:64px;bottom:20px;font-size:15px;letter-spacing:2px;color:#6d8276">BY ZYRALABS</div>`,path.join(play,'images/phoneScreenshots',name+'.png'));
 }
 await render(1320,2868,`${wave}<div class="wordmark" style="position:absolute;left:100px;top:130px;font-size:70px">murmur<span class="dot">.</span></div><div style="position:absolute;left:105px;top:265px;font-size:25px;letter-spacing:4px">IOS CONCEPT · BY ZYRALABS</div><h1 style="position:absolute;left:100px;top:560px;font-size:140px;line-height:1.05;margin:0">Less typing.<br>More you.</h1><div style="position:absolute;left:370px;top:1150px;width:580px;height:580px;border-radius:130px;overflow:hidden;box-shadow:0 40px 100px #285b4020">${icon}</div><div style="position:absolute;left:110px;top:1960px;font-size:52px;line-height:1.8">Speak naturally.<br>Keep your thoughts.<br>Share when ready.</div><p style="position:absolute;left:110px;top:2520px;font-size:28px;line-height:1.5;color:#61776a">Brand artwork for a future iOS app.<br>No iOS release is available yet.</p>`,path.join(store,'apple/drafts/brand-card-1320x2868.png'));
}finally{await browser.close();}
console.log('Prepared Play listing text and images, plus clearly marked deferred iOS brand assets.');
