'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const output=path.resolve(__dirname,'../../tmp/operating-guidance-qa');
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync)});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-09-12T14:00:00+09:00')});
  for(const width of [1440,1366,1024,760,390,320]){
   await page.setViewportSize({width,height:width===1366?768:900});
   await page.goto(pathToFileURL(path.resolve(__dirname,'../main-screen.html')).href);
   await page.evaluate(()=>document.fonts.ready);
   assert.match(await page.locator('.v-finance-thermo-summary').innerText(),/현재 나의 금융지수/);
   assert.equal(await page.locator('.v-finance-thermo-basis').innerText(),'최근 1개월 일별 이동평균 지수');
   const fits=await page.locator('.v-finance-source').evaluateAll(items=>items.every(item=>{
    const label=item.querySelector('span').getBoundingClientRect(),status=item.querySelector('small').getBoundingClientRect(),box=item.getBoundingClientRect();
    return label.bottom<=status.top+1 && label.right<=box.right+1 && status.right<=box.right+1;
   }));
   assert.ok(fits,'connection labels must not overlap at '+width);
   assert.match(await page.locator('.v-market-metric').first().innerText(),/▼/);
   assert.match(await page.locator('.v-market-metric').nth(1).innerText(),/▲/);
   assert.match(await page.locator('.v-market-metric').first().innerText(),/서비스 이용 가게 4곳/);
   assert.ok(await page.locator('.v-market-metric').evaluateAll(items=>items.every(item=>item.scrollWidth<=item.clientWidth+1)));
   await page.screenshot({path:path.join(output,'thermometer-'+width+'.png')});
   const guide=page.locator('.v-dashboard-guidance');
   await guide.scrollIntoViewIfNeeded();
   assert.match(await guide.innerText(),/최근 30일 참고/);
   assert.ok(!(await guide.innerText()).includes('관측 범위'));
   assert.match(await guide.innerText(),/하루 매출 중 비중/);
   assert.ok(await guide.locator('.v-guidance-note').isVisible(),'reference period must remain visible at '+width);
   assert.equal(await guide.locator('.v-guidance-checklist > div').count(),2);
   await page.locator('#guideHourButton').click();await page.locator('[data-guide-hour="8"]').click();
   const before=await guide.locator('.v-guidance-facts').innerText();
   await page.locator('#guideHourButton').click();await page.locator('[data-guide-hour="18"]').click();
   assert.notEqual(await guide.locator('.v-guidance-facts').innerText(),before);
   await page.locator('.v-dashboard-context').scrollIntoViewIfNeeded();
   assert.match(await page.locator('.v-dashboard-context').innerText(),/토요일/);
   assert.equal(await page.locator('.v-context-bars > div').count(),6);
   assert.ok(await page.locator('.v-context-bars small').evaluateAll(labels=>labels.every(label=>{
    const range=document.createRange();range.selectNodeContents(label);
    return range.getBoundingClientRect().width<=label.clientWidth+1;
   })),'chart time labels must fit at '+width);
   await page.locator('[data-context-mode="consumption"]').click();
   assert.equal(await page.locator('[data-context-mode="consumption"]').getAttribute('aria-pressed'),'true');
   assert.match(await page.locator('.v-context-source').innerText(),/서비스 이용 가게 4곳/);
   assert.match(await page.locator('.v-context-chart-unit').innerText(),/만 원/);
   assert.ok(!(await page.locator('.v-context-bars').innerText()).includes('만만'));
   assert.ok(await page.locator('.v-context-bars strong').evaluateAll(labels=>labels.every(label=>{
    const range=document.createRange();range.selectNodeContents(label);
    return range.getBoundingClientRect().width<=label.clientWidth+1;
   })),'chart consumption amounts must fit at '+width);
   await page.screenshot({path:path.join(output,'consumption-'+width+'.png')});
   await page.locator('[data-context-mode="traffic"]').click();
   assert.match(await page.locator('.v-context-highlight h3').innerText(),/12~14시/);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no page overflow at '+width);
   await page.screenshot({path:path.join(output,'guidance-'+width+'.png')});
  }
  await page.clock.fastForward(10*3600*1000);
  assert.match(await page.locator('.v-context-kicker').innerText(),/2026.09.13.*일요일/);
  assert.deepEqual(errors,[]);
  console.log('PASS 6 viewports: labels, trend arrows, 30-day guidance, two actions, metric switching, neighborhood tabs and midnight refresh');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
