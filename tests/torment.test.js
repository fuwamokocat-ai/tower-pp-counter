const {JSDOM} = require('jsdom');
const html = require('fs').readFileSync(require('path').join(__dirname, '../index.html'),'utf8');
function run(torment){
  const dom = new JSDOM(html, {runScripts:'dangerously', url:'https://x.test/', pretendToBeVisual:true});
  const w = dom.window, d = w.document; w.matchMedia = () => ({matches:false}); w.scrollTo=()=>{};
  w.console.error = (...a) => console.log('CE', String(a[0]&&a[0].stack||a[0]).slice(0,200));
  return new Promise(res => setTimeout(() => {
    const t = s => d.querySelector(s)?.textContent.replace(/\s+/g,' ').trim();
    d.querySelector('[data-act="clear-sample"]').click();
    d.querySelector('[data-field="p1"]').click(); d.querySelector('[data-act="switch-clear"]')?.click();
    const q = d.getElementById('q0'); q.value='メタグロス'; q.dispatchEvent(new w.Event('input',{bubbles:true})); d.querySelector('#sg0 button').click();
    const mv = n => [...d.querySelectorAll('#slot0 .mv')].find(b=>b.textContent.includes(n));
    mv('じしん').click();
    if (torment) [...d.querySelectorAll('[data-our]')].find(b=>b.textContent.includes('いちゃもん')).click();
    if (torment) console.log('tag:', t('#slot0 .est-sum'), '|', mv('じしん').querySelector('.tags').textContent);
    mv('コメットパンチ').click();
    console.log(torment ? 'いちゃもんあり' : 'なし', [...d.querySelectorAll('#slot0 .set')].slice(0,4).map(e => e.querySelector('.pct').textContent + ' ' + (e.querySelector('.lik')?.textContent || '') ).join(' | '));
    console.log('  infer:', t('#slot0 .infer') || '-');
    res();
  }, 80));
}
run(false).then(() => run(true));
