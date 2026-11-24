// パーティ登録の確認: 登録画面から別のパーティを入れ、3匹それぞれを場に出して全種・全技をタップしてもエラーが出ないこと。
// あわせて、保存した登録の読み込み・旧版の保存データの読み替え・入力チェックを確かめる。
const {JSDOM} = require('jsdom');
const path = require('path');
const html = require('fs').readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const KEY = 'tower-pp-counter-v1', PKEY = 'tower-pp-counter-party-v1';
let fails = 0;
const check = (name, ok, extra) => { if (!ok) fails++; console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : (extra ?? '')); };

function boot(seed){
  const dom = new JSDOM(html, {runScripts:'dangerously', url:'https://x.test/', pretendToBeVisual:true,
    beforeParse(w){ w.matchMedia = () => ({matches:false}); w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = () => {}; for (const k in (seed || {})) w.localStorage.setItem(k, seed[k]); }});
  const w = dom.window, d = w.document;
  const st = {errs: 0}; w.console.error = (...a) => { if (st.errs++ < 3) console.log('CONSOLE.ERROR', String(a[0] && a[0].stack || a[0]).slice(0, 300)); };
  const type = (sel, v) => { const el = d.querySelector(sel); el.value = v; el.dispatchEvent(new w.Event('input', {bubbles:true})); };
  const txt = sel => { const el = d.querySelector(sel); return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; };
  return {w, d, st, type, txt};
}
// 登録画面に1匹ぶん入力する(名前はひらがなで入れて候補から選ぶ)
function fill(t, i, mon){
  t.type(`[data-pf="${i}:sp"]`, mon.kana);
  const pick = [...t.d.querySelectorAll(`#psg${i} button`)].find(b => b.textContent.trim() === mon.sp);
  if (pick) pick.click();   // 読みが正式名と1つだけ一致したときは候補を出さずにそのまま確定する
  if (mon.ability) t.type(`[data-pf="${i}:ability"]`, mon.ability);
  if (mon.gender) t.type(`[data-pf="${i}:gender"]`, mon.gender);
  for (const k of ['level','hp','def','spd','spe']) t.type(`[data-pf="${i}:${k}"]`, mon[k]);
  for (let k = 0; k < 4; k++) t.type(`[data-pf="${i}:mv${k}"]`, mon.moves[k] || '');
}
const PARTY = [
  {sp:'カビゴン', kana:'かびごん', ability:'THICK_FAT', gender:'MON_MALE', level:50, hp:267, def:117, spd:130, spe:50, moves:['のろい','ねむる','すてみタックル','じしん']},
  {sp:'ラティオス', kana:'らてぃおす', level:50, hp:155, def:100, spd:130, spe:178, moves:['めいそう','リフレクター','ドラゴンクロー','じこさいせい']},
  {sp:'ミロカロス', kana:'みろかろす', gender:'MON_FEMALE', level:50, hp:202, def:144, spd:145, spe:101, moves:['なみのり','じこさいせい','ひかりのかべ','どくどく']},
];

// 全種・全技を、3匹それぞれが場にいる状態でタップする
function tapAll(t, fieldIdx){
  const {w, d} = t;
  d.querySelector(`[data-field="p${fieldIdx}"]`).click(); d.querySelector('[data-act="switch-clear"]')?.click();
  const sp = [...new Set(JSON.parse(d.getElementById('data').textContent).mons.map(m => m.sp))];
  let taps = 0, nolik = 0, hints = 0;
  for (const name of sp){
    d.querySelector('[data-clear="0"]')?.click();
    t.type('#q0', name);
    const b = [...d.querySelectorAll('#sg0 button')].find(x => x.querySelector('.nm').textContent === name); if (!b) continue; b.click();
    const n = d.querySelectorAll('#slot0 .mv').length;
    for (let k = 0; k < n; k++){
      d.querySelectorAll('#slot0 .mv')[k].click(); taps++;
      if (!d.querySelector('#slot0 .lik') && !d.querySelector('#slot0 .infer.warn')) nolik++;
      if (d.querySelector('#slot0 .infer:not(.warn)')) hints++;
      d.getElementById('undo').click();
    }
  }
  return {taps, nolik, hints};
}

setTimeout(() => {
  // ---- 1. 初期のパーティ ----
  let t = boot();
  check('初期は ファイヤー・ハガネール・ヌケニン', t.txt('#field').includes('ファイヤー') && t.txt('#field').includes('ハガネール') && t.txt('#field').includes('ヌケニン'), t.txt('#field'));
  check('初期はプレッシャーで2減る', t.txt('#field').includes('プレッシャー 2減る'));

  // ---- 2. 入力チェック ----
  t.d.querySelector('[data-act="clear-sample"]').click();
  t.d.getElementById('party-open').click();
  check('登録画面が開く', !t.d.getElementById('pedit').hidden && t.d.querySelectorAll('#pedit .pcard').length === 3);
  t.type('[data-pf="0:sp"]', 'そんざいしない');
  t.d.querySelector('[data-pact="save"]').click();
  check('知らないポケモン名は保存できない', t.txt('#pe-err').includes('1匹目') && !t.d.getElementById('pedit').hidden, t.txt('#pe-err'));
  t.type('[data-pf="0:sp"]', 'はがねーる');
  t.d.querySelector('[data-pact="save"]').click();
  check('同じポケモン2匹は保存できない', t.txt('#pe-err').includes('同じポケモン'), t.txt('#pe-err'));

  // ---- 3. 別のパーティを登録 ----
  PARTY.forEach((m, i) => fill(t, i, m));
  check('範囲外の数値がない', t.d.querySelectorAll('#pedit small.bad').length === 0, [...t.d.querySelectorAll('#pedit small.bad')].map(x => x.id + ':' + x.textContent).join(' '));
  t.type('[data-pf="1:spe"]', 400);
  check('範囲外の数値は赤く出る', t.d.querySelectorAll('#pedit small.bad').length === 1);
  t.type('[data-pf="1:spe"]', 178);
  t.d.querySelector('[data-pact="save"]').click();
  check('保存すると登録画面が閉じる', t.d.getElementById('pedit').hidden, t.txt('#pe-err'));
  check('場のボタンが新しい3匹になる', ['カビゴン','ラティオス','ミロカロス'].every(n => t.txt('#field').includes(n)) && !t.txt('#field').includes('プレッシャー'), t.txt('#field'));
  const saved = JSON.parse(t.w.localStorage.getItem(PKEY));
  check('登録が保存される', saved && saved.length === 3 && saved[0].sp === 'カビゴン' && saved[0].ability === 'THICK_FAT' && saved[1].moves.length === 4);
  check('自分の技が新しいパーティのものになる', t.txt('#our-moves').includes('のろい') && t.txt('#our-moves').includes('じしん'), t.txt('#our-moves'));
  check('HPが新しい最大値になる', t.d.getElementById('our-hp').value === '267' && t.txt('#our-max') === '/267');

  // ---- 4. PPの減り方と色分け ----
  t.type('#q0', 'ゲンガー'); t.d.querySelector('#sg0 button').click();
  const mv = n => [...t.d.querySelectorAll('#slot0 .mv')].find(b => b.querySelector('.mv-name').textContent === n);
  const before = +mv('シャドーボール').querySelector('.pp').textContent;
  mv('シャドーボール').click();
  check('プレッシャーがなければ1減る', +mv('シャドーボール').querySelector('.pp').textContent === before - 1);
  check('カビゴン(ノーマル)にシャドーボールは色が付かない', !mv('シャドーボール').classList.contains('weak'));
  t.d.querySelector('[data-field="p1"]').click();
  check('ラティオスに交代するとシャドーボールが抜群表示になる', mv('シャドーボール').classList.contains('weak') && mv('シャドーボール').textContent.includes('抜群'));
  t.d.querySelector('[data-act="switch-clear"]')?.click();
  [...t.d.querySelectorAll('[data-our]')].find(b => b.textContent === 'リフレクター').click();
  check('リフレクターが自分側の状態に出る', t.txt('#our-side').includes('リフレクター'), t.txt('#our-side'));
  [...t.d.querySelectorAll('[data-our]')].find(b => b.textContent === 'めいそう').click();
  check('めいそうで特攻・特防が+1になる', /特攻.*\+1/.test(t.txt('#stage')) && /特防.*\+1/.test(t.txt('#stage')), t.txt('#stage'));
  check('ここまでエラーなし', t.st.errs === 0);

  // ---- 5. 保存した登録の読み込み + 3匹それぞれで全技タップ ----
  let all = 0;
  for (let f = 0; f < 3; f++){
    const u = boot({[PKEY]: JSON.stringify(saved)});
    u.d.querySelector('[data-act="clear-sample"]').click();
    if (f === 0) check('再読み込みしても登録が残る', u.txt('#field').includes('カビゴン'), u.txt('#field'));
    const r = tapAll(u, f);
    all += r.taps;
    check(`${PARTY[f].sp}が場: ${r.taps}回タップしてエラー0件・確率表示なし0件(推理が出た回数 ${r.hints})`, u.st.errs === 0 && r.nolik === 0 && r.taps > 1400, `errors ${u.st.errs} no-prob ${r.nolik}`);
    u.w.close();
  }

  // ---- 6. 旧版の保存データ(場のキーが moltres など)を読み替えられる ----
  const old = {field:'steelix', slots:[{sp:'ゲンガー', used:{}, excl:[], down:false},{sp:null, used:{}, excl:[], down:false},{sp:null, used:{}, excl:[], down:false}], streak:100, log:[], sample:false, trainer:null,
    stages:{moltres:{def:0,spd:0,eva:2},steelix:{def:1,spd:0,eva:0},shedinja:{def:0,spd:0,eva:0}}, hp:{moltres:100, steelix:150, shedinja:1},
    ostatus:{moltres:'none', steelix:'para', shedinja:'none'}, sub:{moltres:false, steelix:false, shedinja:false}, ourLast:{moltres:0, steelix:0, shedinja:0}, ourHist:{moltres:[], steelix:[], shedinja:[]},
    weather:'AI_WEATHER_NONE', eside:{}, spikes:false, future:0, turn:3, tgtFirst:false, baton:null, switchFrom:'moltres'};
  old.hist = [JSON.stringify(Object.assign({}, old, {field:'moltres', switchFrom:null}))];
  const o = boot({[KEY]: JSON.stringify(old)});
  check('旧データ: 場がハガネールのまま', o.d.querySelector('[data-field="p1"]').getAttribute('aria-pressed') === 'true');
  check('旧データ: HPと状態が引き継がれる', o.d.getElementById('our-hp').value === '150' && o.d.getElementById('our-status').value === 'para');
  check('旧データ: 能力ランクが引き継がれる', /防御.*\+1/.test(o.txt('#stage')), o.txt('#stage'));
  o.d.getElementById('undo').click();
  check('旧データ: 取り消しで前の場(ファイヤー)に戻る', o.d.querySelector('[data-field="p0"]').getAttribute('aria-pressed') === 'true' && o.d.getElementById('our-hp').value === '100');
  check('旧データ: エラーなし', o.st.errs === 0);

  // ---- 7. スマホ表示・相手の壁とみらいよちの数え方 ----
  const v = boot();
  check('スマホ用の viewport 指定がある', /width=device-width/.test(v.d.querySelector('meta[name="viewport"]')?.content || ''));
  v.d.querySelector('[data-act="clear-sample"]').click();
  const D = JSON.parse(v.d.getElementById('data').textContent), MVD = D.moves;
  const st = () => JSON.parse(v.w.localStorage.getItem(KEY));
  const side = (eff, read) => {
    // その技を持つ型を探し、その技を1回、ほかの技を続けてタップして、COMに見える回数を数える
    const m = D.mons.find(x => x.moves.some(id => MVD[id].effect === eff) && x.moves.some(id => MVD[id].effect !== eff && MVD[id].pp >= 15));
    const use = m.moves.find(id => MVD[id].effect === eff), other = m.moves.find(id => MVD[id].effect !== eff && MVD[id].pp >= 15);
    v.d.querySelector('[data-clear="0"]')?.click();
    v.type('#q0', m.sp); [...v.d.querySelectorAll('#sg0 button')].find(x => x.querySelector('.nm').textContent === m.sp).click();
    v.d.querySelector(`[data-use="0:${use}"]`).click();
    const seen = [read(st())];
    for (let k = 0; k < 6; k++){ v.d.querySelector(`[data-use="0:${other}"]`).click(); seen.push(read(st())); }
    return seen;
  };
  // 値 n が 0 より大きい間は COM に見える(次のタップの計算で読まれてから1減る)
  const seenTurns = seen => seen.slice(0, -1).filter(n => n > 0).length;
  const rf = side('REFLECT', s => s.eside.REFLECT || 0);
  check('相手のリフレクターはCOMに4回見える', seenTurns(rf) === 4, rf.join(','));
  const fs = side('FUTURE_SIGHT', s => s.future || 0);
  check('相手のみらいよちはCOMに2回見える', seenTurns(fs) === 2, fs.join(','));
  check('壁・みらいよちの確認でエラーなし', v.st.errs === 0);

  console.log(`taps ${all} / ${fails ? fails + ' 件失敗' : 'すべて成功'}`);
  process.exit(fails ? 1 : 0);
}, 80);
