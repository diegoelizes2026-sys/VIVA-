const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ deviceScaleFactor: 2 });
  await pg.goto('file://' + __dirname + '/panfleto.html');
  await pg.evaluate(() => document.fonts.ready);
  await pg.pdf({ path: 'panfleto-A5.pdf', width: '154mm', height: '216mm', printBackground: true, preferCSSPageSize: true });
  await pg.setViewportSize({ width: 582, height: 1633 });
  const els = await pg.$$('.pg');
  for (let i = 0; i < els.length; i++) await els[i].screenshot({ path: `prev${i}.png` });
  await b.close();
})();
