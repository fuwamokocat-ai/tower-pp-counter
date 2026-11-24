// run every set's every move once on the page path to catch other errors
const {JSDOM} = require('jsdom');
const html = require('fs').readFileSync(require('path').join(__dirname, '../index.html'),'utf8');
const dom = new JSDOM(html, {runScripts:'dangerously', url:'https://x.test/', pretendToBeVisual:true});
const w = dom.window, d = w.document; w.matchMedia = () => ({matches:false}); w.scrollTo=()=>{};
let errs = 0; w.console.error = (...a) => { if (errs++ < 3) console.log('CONSOLE.ERROR', String(a[0] && a[0].stack || a[0]).slice(0,300)); };
setTimeout(() => {
  d.querySelector('[data-act="clear-sample"]').click();
  const sp = [...new Set(JSON.parse(d.getElementById('data').textContent).mons.map(m => m.sp))];
  let taps = 0, nolik = 0;
  for (const name of sp){
    d.querySelector('[data-clear="0"]')?.click();
    const q = d.getElementById('q0'); q.value = name; q.dispatchEvent(new w.Event('input',{bubbles:true}));
    const b = [...d.querySelectorAll('#sg0 button')].find(x => x.querySelector('.nm').textContent === name); if (!b) continue; b.click();
    const n = d.querySelectorAll('#slot0 .mv').length;
    for (let k = 0; k < n; k++){ d.querySelectorAll('#slot0 .mv')[k].click(); taps++;
      if (!d.querySelector('#slot0 .lik') && !d.querySelector('#slot0 .infer.warn')) nolik++;
      d.getElementById('undo').click(); }
  }
  console.log('taps', taps, 'errors', errs, 'no-prob-shown', nolik);
}, 80);
