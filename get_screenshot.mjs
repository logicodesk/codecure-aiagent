import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('LOG:', msg.text().replace(/\r/g, ' ')));
  page.on('pageerror', error => console.log('ERROR:', error.message.replace(/\r/g, ' ')));
  
  try {
    console.log('Navigating...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'screenshot.png' });
    console.log('Screenshot saved to screenshot.png');
    
    // Check if #root has children
    const rootLen = await page.$eval('#root', el => el.innerHTML.length);
    console.log('Root HTML length:', rootLen);
    if (rootLen > 0) {
      console.log('SUCCESS: Page is rendering!');
    } else {
      console.log('FAILURE: Blank page!');
    }
  } catch (err) {
    console.log('Navigation ended with:', err.message);
  }
  
  await browser.close();
})();
