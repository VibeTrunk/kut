// Local artifact rendering; Browser plugin discovery returned no connected browser.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../../docs/design/features');
fs.mkdirSync(out,{recursive:true});
const screens=['wanted','tradecards','adminreports','home','report','saved','recap','attendance','packs','value','copies','editions'];
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const url=s=>pathToFileURL(path.join(here,'prototype.html')).href+'?screen='+s;
const checks=[];
async function ready(s){await page.goto(url(s));await page.evaluate(()=>document.fonts.ready);}
async function captureMobile(name){
  // Preserve the true viewport separately. Long artboards relocate the fixed
  // bar to the document foot so it cannot obscure the middle of a full-page image.
  await page.screenshot({path:path.join(out,`${name}-mobile-viewport.png`)});
  const style=await page.addStyleTag({content:'body{position:relative}.bottomnav{position:absolute}.topbar{position:relative}'});
  await page.screenshot({path:path.join(out,`${name}-mobile.png`),fullPage:true});
  await style.evaluate(el=>el.remove());
}
for(const width of [320,360,390,430,768,1440]){
  await page.setViewportSize({width,height:width<640?844:1000});
  for(const s of screens){
    await ready(s);
    const metric=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,fonts:document.fonts.check('16px Archivo')&&document.fonts.check('30px "Instrument Serif"'),h1:document.querySelector('h1').getBoundingClientRect().width}));
    if(metric.scroll>width)throw new Error(`${s} overflows at ${width}: ${metric.scroll}`);
    if(!metric.fonts)throw new Error('Fonts missing');
    checks.push({screen:s,width,overflow:0});
    if(width===390)await captureMobile(s);
    if(width===1440&&['wanted','adminreports','report','packs','value','editions'].includes(s))await page.screenshot({path:path.join(out,`${s}-desktop.png`),fullPage:true});
  }
}
await page.setViewportSize({width:390,height:844});
await ready('wanted');await page.getByRole('button',{name:'+ Add cards',exact:true}).click();
await page.getByRole('textbox',{name:'Search players'}).fill('Dana');
if(await page.locator('#wants .pick:visible').count()!==1)throw new Error('Picker search did not filter');
await page.locator('[data-act="pick-want:dana"]').click();
await page.getByRole('button',{name:'Done',exact:true}).click();
if(!await page.getByRole('button',{name:'Remove Dana Demo from wanted cards'}).isVisible())throw new Error('Wishlist add failed');
await page.getByRole('button',{name:'Remove Dana Demo from wanted cards'}).click();
await page.getByRole('button',{name:'+ Add cards',exact:true}).click();
await page.screenshot({path:path.join(out,'wanted-picker-mobile.png')});
await page.keyboard.press('Escape');
if(await page.locator('dialog').isVisible())throw new Error('Dialog Escape failed');
await ready('report');await page.getByRole('button',{name:'2',exact:true}).click();
await page.locator('[data-act="nominate:team"]').click();
await page.screenshot({path:path.join(out,'kudos-picker-mobile.png')});
await page.locator('[data-act="pick-nominee:bea"]').click();
await page.locator('[data-act="nominate:wall"]').click();
if(!await page.locator('[data-act="pick-nominee:bea"]').isDisabled())throw new Error('Repeated nominee allowed');
await page.locator('[data-act="pick-nominee:dana"]').click();
await page.locator('[data-act="nominate:vibes"]').click();await page.getByRole('button',{name:'Skip this category'}).click();
await page.getByRole('button',{name:'Submit report · earn 50 coins',exact:true}).click();
if(!page.url().includes('saved'))throw new Error('Report not saved');
if(!await page.getByLabel('550 KUT Coins',{exact:true}).isVisible())throw new Error('Completion award missing');
await captureMobile('saved');
await page.getByRole('link',{name:'Edit my report'}).click();
await page.getByLabel('Another number').fill('10');
await page.getByLabel('Another number').fill('');
if(await page.getByLabel('Another number').inputValue()!=='')throw new Error('Cannot clear goals');
await page.getByRole('button',{name:'0',exact:true}).click();
await page.getByRole('button',{name:'Save changes',exact:true}).click();
if(!await page.getByLabel('550 KUT Coins',{exact:true}).isVisible())throw new Error('Edit rewarded twice');
await ready('report&state=closed');
if(!await page.getByRole('button',{name:'0',exact:true}).isDisabled())throw new Error('Closed report is editable');
await captureMobile('report-closed');
await ready('report');await page.getByRole('button',{name:'Submit report · earn 50 coins',exact:true}).click();
if(!await page.getByRole('alert').isVisible())throw new Error('Empty report validation missing');
await captureMobile('report-error');
await ready('packs');await page.getByRole('button',{name:'Open for 175 KUT Coins'}).click();
await page.screenshot({path:path.join(out,'pack-confirm-mobile.png')});
await page.getByRole('button',{name:'Confirm · 175 KUT Coins'}).click();
if(!await page.getByText('Wallet now 325 KUT Coins').isVisible())throw new Error('Pack arithmetic failed');
await ready('packs&state=insufficient');
if(!await page.getByRole('button',{name:'Need 1 more KUT Coin',exact:true}).isDisabled())throw new Error('174 can buy pack');
await page.screenshot({path:path.join(out,'pack-insufficient-mobile.png')});
await ready('copies');await page.getByLabel('Try the calculation · number of copies').fill('2');await page.getByLabel('Try the calculation · number of copies').press('Tab');
if(!await page.getByRole('heading',{name:'2 copies. 121 value.'}).isVisible())throw new Error('Duplicate weighting mismatch');
await ready('wanted');
if(await page.getByRole('link',{name:'Matches',exact:true}).count())throw new Error('Matching nav still present');
await page.getByRole('button',{name:'How to complete a trade'}).click();
await page.screenshot({path:path.join(out,'trade-help-mobile.png')});await page.keyboard.press('Escape');
await ready('report');await page.getByRole('button',{name:'0',exact:true}).click();
for(const key of ['team','wall','vibes']){await page.locator(`[data-act="nominate:${key}"]`).click();await page.getByRole('button',{name:'Skip this category'}).click();}
await page.getByRole('button',{name:'Submit report · earn 50 coins',exact:true}).click();
if(!await page.getByLabel('550 KUT Coins',{exact:true}).isVisible())throw new Error('Zero/skips should earn reward');
await ready('adminreports');
await page.locator('[data-act="edit-admin-goals:ellis"]').click();
await page.screenshot({path:path.join(out,'admin-goals-mobile.png')});
await page.getByLabel('Goals scored',{exact:true}).fill('2');await page.getByLabel('Reason for this change').fill('Confirmed after football');await page.getByRole('button',{name:'Save goals',exact:true}).click();
if(!await page.locator('.admin-report-row').filter({hasText:'Ellis Sample'}).getByText('Admin',{exact:true}).isVisible())throw new Error('Guest goal entry failed');
if(!await page.getByLabel('500 KUT Coins',{exact:true}).isVisible())throw new Error('Admin entry awarded coins');
await page.locator('[data-act="edit-admin-goals:alex"]').click();await page.getByLabel('Goals scored',{exact:true}).fill('3');await page.getByLabel('Reason for this change').fill('Corrected confirmed total');await page.getByRole('button',{name:'Save goals',exact:true}).click();
if(!await page.locator('.admin-report-row').filter({hasText:'Alex Example'}).getByText('Admin',{exact:true}).isVisible())throw new Error('Member correction failed');
await captureMobile('adminreports-corrected');
await page.getByRole('button',{name:'No account',exact:true}).click();
if(await page.locator('.admin-report-row').count()!==2)throw new Error('No-account filter failed');
await ready('wanted&state=empty');await page.screenshot({path:path.join(out,'wanted-empty-mobile.png'),fullPage:true});
await page.goto(pathToFileURL(path.join(here,'index.html')).href);
if(await page.locator('[data-screen="matches"],[data-screen="swap"]').count())throw new Error('Superseded gallery screens remain');
await page.locator('[data-screen="adminreports"]').click();
await page.frameLocator('#preview').getByRole('heading',{name:'Session reports',exact:true}).waitFor();
await page.locator('[data-screen="wanted"]').click();
await page.frameLocator('#preview').getByRole('heading',{name:'Wanted cards',exact:true}).waitFor();
if(errors.length)throw new Error(errors.join('\n'));
await browser.close();
const sheetScreens=['wanted','adminreports','report','packs','value','editions'];
const tileWidth=300, tileHeight=649, gap=24;
const composites=[];
for(let i=0;i<sheetScreens.length;i++){
  const img=await sharp(path.join(out,`${sheetScreens[i]}-mobile-viewport.png`)).resize({width:tileWidth,height:tileHeight}).png().toBuffer();
  composites.push({input:img,left:gap+(i%3)*(tileWidth+gap),top:gap+Math.floor(i/3)*(tileHeight+gap)});
}
await sharp({create:{width:3*tileWidth+4*gap,height:2*tileHeight+3*gap,channels:3,background:'#0b0a07'}}).composite(composites).png().toFile(path.join(out,'overview.png'));
const interactions=['wishlist add/remove/search','picker Escape','goals save/edit/clear/zero','distinct nominee selection','closed report','empty report validation','175 pack confirm and 325 balance','174 insufficient','duplicate arithmetic','simple availability and trade instructions','zero goals / all skips rewarded','completion edit not rewarded twice','admin guest goals and member correction'];
fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({kind:'design-prototype-only',viewports:checks,interactions,pageErrors:errors,databaseTestsRun:false},null,2)+'\n');
console.log(`Rendered ${screens.length} primary mobile screens and 6 desktop screens. ${checks.length} layout checks and ${interactions.length} interaction groups passed.`);
