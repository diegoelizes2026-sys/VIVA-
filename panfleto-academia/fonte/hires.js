const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ deviceScaleFactor: 3.125, viewport: { width: 582, height: 1633 } });
  await pg.goto('file://' + __dirname + '/panfleto.html');
  await pg.evaluate(() => document.fonts.ready);
  const els = await pg.$$('.pg');
  for (let i = 0; i < els.length; i++) await els[i].screenshot({ path: `hi${i}.png` });
  await b.close();
})();
