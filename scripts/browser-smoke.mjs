import { chromium } from 'playwright';

const browser = await chromium.launch({headless:true});
let failed = false;
for (const [label,width,height] of [['desktop',1440,900],['mobile',390,844],['tablet',820,1180]]) {
  const page = await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  const missing = [];
  page.on('response',res => {if(res.status() >= 400 && /\.(?:css|js)(?:\?|$)/.test(res.url()))missing.push(res.url());});
  try {
    await page.goto('http://127.0.0.1:8765/', {waitUntil:'domcontentloaded',timeout:30000});
    await page.locator('body').waitFor();
    await page.waitForTimeout(900);
    const result = await page.evaluate(() => ({
      scrollWidth:document.documentElement.scrollWidth,
      windowWidth:window.innerWidth,
      cssCount:[...document.styleSheets].length,
      loginVisible:!!document.querySelector('#authOverlay'),
      transferBytes:performance.getEntriesByType('resource').reduce((n,e)=>n+(e.transferSize||0),0),
      resources:performance.getEntriesByType('resource').length,
      domContentLoadedMs:Math.round(performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd||0),
    }));
    const network = await page.evaluate(() => {
      const entries=performance.getEntriesByType('resource');
      const byType={};
      for(const e of entries){
        const name=e.name.split('?')[0];
        const ext=name.match(/\\.(js|css|webp|png|svg|woff2?)$/i)?.[1]?.toLowerCase()||'other';
        const row=byType[ext] ||= {count:0,transferBytes:0};
        row.count++;
        row.transferBytes+=e.transferSize||0;
      }
      return byType;
    });
    console.log(label,JSON.stringify(result));
    console.log('resource-breakdown',label,JSON.stringify(network));
    if(missing.length || result.cssCount < 6 || !result.loginVisible || result.scrollWidth > result.windowWidth+3) {
      console.error('Browser smoke failure:',label,{missing,result});
      failed = true;
    }
    await page.screenshot({path:'browser-smoke-'+label+'.png',fullPage:false});
  } catch(e){console.error(label,e);failed=true;}
  await page.close();
}
await browser.close();
if(failed)process.exitCode=1;
