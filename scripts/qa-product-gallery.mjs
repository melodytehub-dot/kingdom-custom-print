import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base=process.env.QA_BASE??'http://localhost:3000';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
let colors=0;
try {
 await page.goto(`${base}/shop`,{waitUntil:'load',timeout:60000});
 await page.locator('.mm-card-title a').nth(18).waitFor({ timeout: 60000 });
 const slugs=await page.locator('.mm-card-title a').evaluateAll(links=>links.map(a=>new URL(a.href).pathname.split('/').pop()));
 assert.ok(slugs.length>=19);
 for(const slug of slugs){
  await page.goto(`${base}/product/${slug}`,{waitUntil:'load',timeout:60000});
  await page.locator('.pdp-photo-stage').waitFor();
  if(await page.locator('.pdp-photo-stage canvas').count()) await page.locator('.pdp-photo-stage canvas[data-ready=true]').waitFor();
  for(let i=0;i<await page.locator('.pdp .swatch').count();i++){
   const swatch=page.locator('.pdp .swatch').nth(i);await swatch.click();
   await page.waitForFunction(index=>document.querySelectorAll('.pdp .swatch')[index]?.getAttribute('aria-pressed')==='true',i);
   const colorName=await swatch.getAttribute('title');
   assert.equal(await swatch.getAttribute('aria-pressed'),'true');
   const selectedSlug=await page.locator('.pdp-photo-stage .product-photography').getAttribute('data-photo-color');
   assert.ok(selectedSlug);
   const canv=page.locator('.pdp-photo-stage canvas');
   if(await canv.count()){
    const hex=await swatch.evaluate(e=>{const rgb=getComputedStyle(e).backgroundColor.match(/\d+/g).slice(0,3).map(Number);return '#'+rgb.map(c=>c.toString(16).padStart(2,'0')).join('');});
    await page.waitForFunction(expected=>{const c=document.querySelector('.pdp-photo-stage canvas');return c?.dataset.ready==='true'&&c.dataset.color.toLowerCase()===expected;},hex);
    assert.equal(await canv.evaluate(c=>{const ctx=c.getContext('2d');const p=ctx.getImageData(Math.round(c.width/6),Math.round(c.height*.025),1,1).data;return p[3];}),0,'Model neck remains outside fabric overlay');
   }
   assert.match(await page.locator('.pdp-view-caption').innerText(),new RegExp(colorName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
   colors++;
  }
  for(const view of ['front','back','side']){
   await page.getByRole('button',{name:`View ${view}`,exact:true}).click();
   assert.equal(await page.getByRole('button',{name:`View ${view}`,exact:true}).getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('.pdp-photo-stage .product-photography').getAttribute('data-photo-view'),view);
  }
  await page.getByRole('button',{name:'Next product view',exact:true}).click();
  assert.equal(await page.locator('.pdp-photo-stage .product-photography').getAttribute('data-photo-view'),'front');
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Phone overflow ${slug}`);
  await page.setViewportSize({width:1440,height:1000});
  console.log('PASS',slug,'all colors, front/back/side gallery, arrows and phone layout');
 }
 await page.goto(`${base}/customize/crown-classic-tee?color=black`,{waitUntil:'load',timeout:60000});
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('kcp.draft.v3.crown-classic-tee')??'{}').colorCode==='BLK');
 await page.locator('button.rot-tool').filter({hasText:'Add Text'}).first().click();
 await page.locator('.rot-textarea').fill('Gallery regression art');
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('kcp.draft.v3.crown-classic-tee')??'{}').design?.front.some(l=>l.text==='Gallery regression art'));
 await page.goto(`${base}/product/crown-classic-tee?color=red`,{waitUntil:'load',timeout:60000});
 await page.waitForFunction(()=>document.querySelector('button.swatch[title=Red]')?.getAttribute('aria-pressed')==='true');
 await page.getByRole('button',{name:'Customize this',exact:true}).click();
 await page.waitForURL(/\/customize\/crown-classic-tee\?color=red/,{timeout:60000});
 await page.waitForFunction(()=>document.querySelector('image.rot-shirt-photo')?.getAttribute('href')?.includes('color=C8102E&view=front'));
 await page.waitForFunction(()=>{const draft=JSON.parse(localStorage.getItem('kcp.draft.v3.crown-classic-tee')??'{}');return draft.colorCode==='RED'&&draft.design?.front.some(l=>l.text==='Gallery regression art');});
 await page.getByRole('button',{name:'Side profile',exact:true}).click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.rot-profile-preview img')].every(i=>i.complete&&i.naturalWidth>0));
 assert.equal(await page.locator('.rot-profile-preview img').count(),1);
 assert.match(await page.locator('.rot-profile-preview img').getAttribute('src'),/view=side/);
 await page.locator('.rot-side-thumb').filter({hasText:'back'}).click();
 assert.match(await page.locator('image.rot-shirt-photo').getAttribute('href'),/view=back/);
 await page.locator('.rot-side-thumb').filter({hasText:'front'}).click();
 assert.match(await page.locator('.rot-canvas-svg').getAttribute('aria-label'),/1 design element/);
 console.log('PASS URL color overrides saved draft color; artwork survives gallery/studio transitions and side preview');
 assert.deepEqual(errors,[]);
 console.log(`ALL GALLERY CHECKS PASSED: ${slugs.length} products and ${colors} color variations; color handoff and clean studio side preview`);
} finally {await browser.close();}
