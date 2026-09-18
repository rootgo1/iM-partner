'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const base = process.env.IM_PREVIEW_URL ? new URL('prototype/main-screen.html', process.env.IM_PREVIEW_URL).href : pathToFileURL(path.resolve(__dirname, '../main-screen.html')).href;
const output = process.env.IM_QA_DIR || path.resolve(__dirname, '../../tmp/diagnosis-layout-qa');
(async () => {
  fs.mkdirSync(output,{recursive:true});
  const browser = await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try {
    const page = await browser.newPage({reducedMotion:'reduce'});
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.clock.install({time:new Date('2026-09-18T19:20:00+09:00')});
    for(const [width,height] of [[1920,1080],[1440,900],[1366,768],[1280,720],[768,900],[390,844],[360,800]]) {
      await page.setViewportSize({width,height});
      for(const view of ['analysis','market']) {
        await page.goto(base+'#'+view); await page.evaluate(()=>document.fonts.ready);
        assert.equal(await page.locator('#sectionPeriodSelect, #sd-period-mount, .sd-filter-comparison').count(),0);
        const panels=page.locator('.v-screen-section'); assert.equal(await panels.count(),4);
        const metrics=await panels.evaluateAll(nodes=>nodes.map(s=>({height:s.clientHeight,viewport:document.querySelector('#viewRoot').clientHeight,inner:s.querySelector('.v-screen-inner').clientHeight,zoom:getComputedStyle(s).zoom,transform:getComputedStyle(s).transform})));
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),view+' overflow '+width);
        const pairs=view==='analysis'
          ? ['#sd-panel-daily-weekly .sd-wide-card > .sd-card','#sd-panel-expenses .sd-expense-grid > .sd-card']
          : ['.ma-trend-charts > .ma-card','.v-neighborhood-layout > .v-card'];
        for(const selector of pairs) {
          const [left,right]=await page.locator(selector).evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}));
          assert.ok(left&&right,selector+' has a complete pair');
          assert.ok(Math.abs(left.width-right.width)<=1,selector+' equal widths at '+width);
          if(Math.abs(left.y-right.y)<=1) assert.ok(Math.abs(left.height-right.height)<=1,selector+' aligned bottoms at '+width);
        }
        if(width>=1280) {
          assert.ok(metrics.every(s=>s.inner<=s.height&&s.transform==='none'&&s.zoom==='1'),'no clipping or font scaling');
          if(view==='market' && width>=1366) {
            const left=await page.locator('.v-dashboard-context').boundingBox(),right=await page.locator('[data-nearby-events]').boundingBox();
            assert.ok(left.x+left.width<=right.x+1,'chart left of map');
          }
        }
        for(let i=0;i<await panels.count();i++) {
          await panels.nth(i).evaluate(s=>s.scrollIntoView({block:'start',behavior:'instant'}));
          if(width===1366) await page.screenshot({path:path.join(output,view+'-'+(i+1)+'.png')});
        }
        if(width===360) {
          await panels.first().evaluate(s=>s.scrollIntoView({block:'start',behavior:'instant'}));
          if(view==='analysis') await page.locator('[data-sd-toggle]').click();
          assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'expanded mobile filters');
        }
      }
    }
    // Supplemental content can grow naturally instead of being clipped to a viewport.
    await page.setViewportSize({width:1366,height:768}); await page.goto(base+'#market');
    const chart=page.locator('#ma-movements .ma-trend-scroll').first();
    await chart.scrollIntoViewIfNeeded();
    assert.ok(await chart.evaluate(n=>n.clientHeight===296&&getComputedStyle(n).overflowY==='auto'),'comparison plot stays compact and can scroll');
    assert.ok(await page.locator('#ma-movements .ma-trend-scroll').last().evaluate(n=>n.scrollHeight>n.clientHeight),'longer weekday plot scrolls inside the matched height');
    await page.locator('[data-ma-detail="hour"]').first().click();
    assert.ok(await page.locator('#ma-dialog').evaluate(n=>n.open));
    await page.keyboard.press('Escape');
    await page.goto(base+'#analysis');
    await page.locator('.sd-weekday-detail summary').click();
    const expanded=await page.locator('#sd-panel-daily-weekly .sd-wide-card > .sd-card').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));
    assert.ok(Math.abs(expanded[0]-expanded[1])<=1,'expanded details keep paired card bottoms aligned');
    for(const view of ['policies','profile']) {
      await page.goto(base+'#'+view);
      assert.equal(await page.locator('.v-screen-section').count(),1,view+' forms one continuous page');
      assert.equal(await page.locator('.v-screen-section').evaluate(n=>getComputedStyle(n).minHeight),'0px','no forced empty viewport');
    }
    assert.deepEqual(errors,[]);
    console.log('PASS diagnosis layout: 4 sales + 4 market sections × 7 viewports, chart/map placement, mobile filters, compact chart details, no JS errors');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
