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
    }));
    console.log(label,JSON.stringify(result));
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
