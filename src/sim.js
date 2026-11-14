// ===== COMの技選択の確率計算 (チェック1→3→2 をそのまま実行し、乱数の分岐は確率で足し合わせる) =====
function makeSim(D, INF){
  const AI = D.ai, MV = D.moves, SL = AI.script.lines, LB = AI.script.labels;
  const RAT = [[10,40],[10,35],[10,30],[10,25],[10,20],[10,15],[10,10],[15,10],[20,10],[25,10],[30,10],[35,10],[40,10]];
  const OUR = {
    moltres: {types:['FIRE','FLYING'], max:177, def:110, spd:128, spe:154, level:50, abil:[['PRESSURE',1]], gender:[['MON_GENDERLESS',1]]},
    steelix: {types:['STEEL','GROUND'], max:182, def:246, spd:114, spe:48, level:50, abil:[['STURDY',.5],['ROCK_HEAD',.5]], gender:[['MON_MALE',1]]},
    shedinja:{types:['BUG','GHOST'], max:1, def:59, spd:45, spe:36, level:45, abil:[['WONDER_GUARD',1]], gender:[['MON_GENDERLESS',1]]},
  };
  const NUM = {FALSE:0, TRUE:1, ITEM_NONE:0, MOVE_NONE:0};
  const val = x => (x in NUM) ? NUM[x] : (/^-?\d+$/.test(x) ? +x : x);
  const EFF = {AI_EFFECTIVENESS_x0:0, AI_EFFECTIVENESS_x0_25:10, AI_EFFECTIVENESS_x0_5:20, AI_EFFECTIVENESS_x1:40, AI_EFFECTIVENESS_x2:80, AI_EFFECTIVENESS_x4:160};
  const STATK = {STAT_ATK:'atk',STAT_DEF:'def',STAT_SPEED:'spe',STAT_SPATK:'spa',STAT_SPDEF:'spd',STAT_ACC:'acc',STAT_EVASION:'eva'};
  const lv = a => a === 'DEFAULT_STAT_STAGE' ? 6 : a === 'MIN_STAT_STAGE' ? 0 : a === 'MAX_STAT_STAGE' ? 12 : +a;
  const S1 = {STATUS1_SLEEP:['sleep'], STATUS1_POISON:['poison'], STATUS1_BURN:['burn'], STATUS1_FREEZE:['freeze'], STATUS1_PARALYSIS:['para'],
    STATUS1_TOXIC_POISON:['toxic'], STATUS1_PSN_ANY:['poison','toxic'], STATUS1_ANY:['sleep','poison','burn','freeze','para','toxic']};
  // テーブル(.byte / .2byte)
  const tables = {};
  function table(lab){
    if (tables[lab]) return tables[lab];
    const out = []; for (let i = LB[lab]; i < SL.length && (SL[i][0] === '.byte' || SL[i][0] === '.2byte'); i++) for (const a of SL[i].slice(1)) if (a !== '-1') out.push(val(a));
    return tables[lab] = out;
  }
  // #ifdef BUGFIX は飛ばす(実機は BUGFIX なし)
  const skipTo = {};
  for (let i = 0; i < SL.length; i++) if (SL[i][0] === '#ifdef'){
    let j = i + 1; while (SL[j][0] !== '#else' && SL[j][0] !== '#endif') j++;
    skipTo[i] = j + 1;
  }
  const isPhys = t => ['NORMAL','FIGHTING','FLYING','POISON','GROUND','ROCK','BUG','GHOST','STEEL'].includes(t);
  function aiEff(mid, userTypes, tgtTypes){
    const t = MV[mid].typeEn; let d = 40;
    if (userTypes.includes(t)) d = Math.floor(d * 15 / 10);
    for (const m of INF.effMuls(t, tgtTypes)){ d = Math.floor(d * m / 10); if (d === 0 && m !== 0) d = 1; }
    if (d === 120) d = 80; if (d === 240) d = 160; if (d === 30) d = 20; if (d === 15) d = 10;
    return d & 255;
  }
  const t2 = ts => ts.length > 1 ? ts[1] : ts[0];

  // 1つの技について、スクリプトを実行して点数の分布を返す。flags: {faint, power:'best'|'not'|'other'}
  function runMove(st, mid, flags){
    const mv = MV[mid], eff = 'EFFECT_' + mv.effect, mc = 'MOVE_' + mv.c;
    const U = st.user, T = st.tgt;
    const out = new Map();
    const add = (s, p) => out.set(s, (out.get(s) || 0) + p);
    function speedRes(){ // GetWhoStrikesFirst(user, target): 0=user先 / 1=target先 / 2=同速で外れ
      const su = U.qc ? Infinity : U.speed, stt = T.speed;
      if (su === stt) return [[0, .5], [2, .5]];
      return su < stt ? [[1, 1]] : [[0, 1]];
    }
    function go(pc, score, r, p){
      for (let guard = 0; guard < 2000; guard++){
        const line = SL[pc]; if (!line){ add(score, p); return; }
        const [op, ...a] = line;
        const J = lab => go(LB[lab], score, r, p);
        const branch = (cond, lab) => { if (cond) { pc = LB[lab]; } else pc++; };
        switch (op){
          case '#ifdef': pc = skipTo[pc]; continue;
          case '#else': { let j = pc; while (SL[j][0] !== '#endif') j++; pc = j + 1; continue; }
          case '#endif': pc++; continue;
          case 'end': add(score, p); return;
          case 'score': score = Math.max(0, score + parseInt(a[0])); pc++; continue;
          case 'goto': pc = LB[a[0]]; continue;
          case 'if_target_is_ally': pc++; continue;
          case 'if_random_less_than': { const q = (+a[0]) / 256; if (q > 0) go(LB[a[1]], score, r, p * q); if (q < 1) go(pc + 1, score, r, p * (1 - q)); return; }
          case 'if_random_greater_than': { const q = (255 - (+a[0])) / 256; if (q > 0) go(LB[a[1]], score, r, p * q); if (q < 1) go(pc + 1, score, r, p * (1 - q)); return; }
          case 'if_effect': branch(a[0] === eff, a[1]); continue;
          case 'if_not_effect': branch(a[0] !== eff, a[1]); continue;
          case 'if_move': branch(a[0] === mc, a[1]); continue;
          case 'if_not_move': branch(a[0] !== mc, a[1]); continue;
          case 'if_equal': case 'if_equal_': branch(r === val(a[0]), a[1]); continue;
          case 'if_not_equal': case 'if_not_equal_': branch(r !== val(a[0]), a[1]); continue;
          case 'if_more_than': branch(r > val(a[0]), a[1]); continue;
          case 'if_less_than': branch(r < val(a[0]), a[1]); continue;
          case 'if_in_bytes': case 'if_in_hwords': branch(table(a[0]).includes(r), a[1]); continue;
          case 'if_not_in_bytes': case 'if_not_in_hwords': branch(!table(a[0]).includes(r), a[1]); continue;
          case 'if_hp_more_than': case 'if_hp_less_than': case 'if_hp_equal': case 'if_hp_not_equal': {
            const h = a[0] === 'AI_USER' ? U.hpPct : T.hpPct, x = +a[1];
            const c = op === 'if_hp_more_than' ? h > x : op === 'if_hp_less_than' ? h < x : op === 'if_hp_equal' ? h === x : h !== x;
            branch(c, a[2]); continue; }
          case 'if_stat_level_more_than': case 'if_stat_level_less_than': case 'if_stat_level_equal': case 'if_stat_level_not_equal': {
            const who = a[0] === 'AI_USER' ? U : T, s = (who.stages[STATK[a[1]]] || 0) + 6, x = lv(a[2]);
            const c = op.endsWith('more_than') ? s > x : op.endsWith('less_than') ? s < x : op.endsWith('not_equal') ? s !== x : s === x;
            branch(c, a[3]); continue; }
          case 'if_status': case 'if_not_status': {
            const who = a[0] === 'AI_USER' ? U : T, fl = a[1].split('|').map(s => s.trim()).flatMap(f => S1[f] || []);
            const has = fl.includes(who.status); branch(op === 'if_status' ? has : !has, a[2]); continue; }
          case 'if_status2': case 'if_not_status2': case 'if_status3': case 'if_not_status3': {
            const who = a[0] === 'AI_USER' ? U : T, fl = a[1].split('|').map(s => s.trim());
            const has = fl.some(f => who.flags.has(f)); branch(op.startsWith('if_status') ? has : !has, a[2]); continue; }
          case 'if_side_affecting': {
            const side = a[0] === 'AI_USER' ? U.side : T.side; branch(side.has(a[1]), a[2]); continue; }
          case 'if_status_in_party': { const fl = S1[a[1]] || []; branch(T.partyStatus.some(s => fl.includes(s)), a[2]); continue; }
          case 'if_type_effectiveness': branch(aiEff(mid, U.types, T.types) === EFF[a[0]], a[1]); continue;
          case 'if_user_faster': case 'if_target_faster': {
            const want = op === 'if_user_faster' ? 0 : 1;
            for (const [res, q] of speedRes()) { if (res === want) go(LB[a[0]], score, r, p * q); else go(pc + 1, score, r, p * q); }
            return; }
          case 'if_level_cond': { const ul = 50, tl = T.level || 50; branch(+a[0] === 0 ? ul > tl : +a[0] === 1 ? ul < tl : ul === tl, a[1]); continue; }
          case 'if_target_not_taunted': pc = LB[a[0]]; continue;
          case 'if_target_taunted': pc++; continue;
          case 'if_not_double_battle': pc = LB[a[0]]; continue;
          case 'if_double_battle': pc++; continue;
          case 'if_ability': branch(false, a[2]); continue;
          case 'if_any_move_disabled': case 'if_any_move_encored': branch(false, a[1]); continue;
          case 'if_user_has_no_attacking_moves': branch(!U.moves.some(x => MV[x].power > 0), a[0]); continue;
          case 'if_has_move': case 'if_doesnt_have_move': {
            const list = a[0] === 'AI_USER' ? U.moves : T.history; const has = list.some(x => 'MOVE_' + MV[x].c === a[1]);
            branch(op === 'if_has_move' ? has : !has, a[2]); continue; }
          case 'if_has_move_with_effect': case 'if_doesnt_have_move_with_effect': {
            const list = a[0] === 'AI_USER' ? U.moves : T.history; const has = list.some(x => 'EFFECT_' + MV[x].effect === a[1]);
            branch(op === 'if_has_move_with_effect' ? has : !has, a[2]); continue; }
          case 'if_can_faint': branch(mv.power >= 2 && flags.faint, a[0]); continue;
          case 'if_cant_faint': branch(!(mv.power >= 2 && flags.faint), a[0]); continue;
          case 'get_how_powerful_move_is': r = flags.power === 'best' ? 'MOVE_MOST_POWERFUL' : flags.power === 'not' ? 'MOVE_NOT_MOST_POWERFUL' : 'MOVE_POWER_OTHER'; pc++; continue;
          case 'get_ability': {
            if (a[0] === 'AI_USER'){ r = 'ABILITY_' + U.ability; pc++; continue; }
            if (T.abil.length === 1){ r = 'ABILITY_' + T.abil[0][0]; pc++; continue; }
            for (const [ab, q] of T.abil) go(pc + 1, score, 'ABILITY_' + ab, p * q);
            return; }
          case 'get_gender': {
            const opts = a[0] === 'AI_USER' ? U.gender : T.gender;
            if (opts.length === 1){ r = opts[0][0]; pc++; continue; }
            for (const [g, q] of opts) if (q > 0) go(pc + 1, score, g, p * q);
            return; }
          case 'get_hold_effect': r = a[0] === 'AI_USER' ? 'HOLD_EFFECT_' + U.hold : 'HOLD_EFFECT_NONE'; pc++; continue;
          case 'get_last_used_bank_move': r = a[0] === 'AI_USER' ? (U.last || 0) : (T.last || 0); pc++; continue;
          case 'get_move_power_from_result': r = r ? MV[r].power : 0; pc++; continue;
          case 'get_move_type_from_result': r = r ? 'TYPE_' + MV[r].typeEn : 'TYPE_NORMAL'; pc++; continue;
          case 'get_move_effect_from_result': r = r ? 'EFFECT_' + MV[r].effect : 'EFFECT_HIT'; pc++; continue;
          case 'get_curr_move_type': r = 'TYPE_' + mv.typeEn; pc++; continue;
          case 'get_target_type1': r = 'TYPE_' + T.types[0]; pc++; continue;
          case 'get_target_type2': r = 'TYPE_' + t2(T.types); pc++; continue;
          case 'get_user_type1': r = 'TYPE_' + U.types[0]; pc++; continue;
          case 'get_user_type2': r = 'TYPE_' + t2(U.types); pc++; continue;
          case 'get_weather': r = st.weather; pc++; continue;
          case 'count_usable_party_mons': r = a[0] === 'AI_USER' ? U.party : T.party; pc++; continue;
          case 'is_first_turn_for': r = (a[0] === 'AI_USER' ? U.first : T.first) ? 1 : 0; pc++; continue;
          case 'get_protect_count': r = U.protect; pc++; continue;
          case 'get_stockpile_count': r = U.stock; pc++; continue;
          case 'get_used_held_item': r = 0; pc++; continue;
          case 'get_turn_count': r = st.turn; pc++; continue;
          default:
            if (op.startsWith('if_')) { pc++; continue; }   // 未対応の条件は不成立扱い
            pc++; continue;
        }
      }
      add(score, p);
    }
    let dist = new Map([[100, 1]]);
    for (const lab of ['AI_CheckBadMove', 'AI_TryToFaint', 'AI_CheckViability']){
      const next = new Map();
      for (const [s, p] of dist){ out.clear(); go(LB[lab], s, 0, p); for (const [s2, p2] of out) next.set(s2, (next.get(s2) || 0) + p2); }
      dist = next;
    }
    return dist;
  }

  // 観測した技 M を、この状態でCOMが選ぶ確率
  function chooseProb(st, M){
    const ms = st.user.moves, HP = st.tgt.hp;
    const usable = ms.map(x => st.usable(x));
    if (!usable[ms.indexOf(M)]) return 0;
    const cmp = ms.filter(x => INF.inCmp(x));
    // 技ごとの想定ダメージ(乱数前)と、乱数16通りの値
    const dv = {};
    for (const x of ms) if (MV[x].power >= 2){
      const d = INF.damage(st.mon, x, st.dmg, st.dtgt);
      const vals = new Map(); for (let r = 85; r <= 100; r++){ const v = Math.max(1, Math.floor(d * r / 100)); vals.set(v, (vals.get(v) || 0) + 1/16); }
      dv[x] = vals;
    }
    const P = (x, f) => { let s = 0; for (const [v, q] of dv[x]) if (f(v)) s += q; return s; };
    const cache = new Map();
    const scores = (x, faint, power) => {
      if (!usable[ms.indexOf(x)]) return new Map([[0, 1]]);
      const k = x + '|' + faint + '|' + power;
      if (!cache.has(k)) cache.set(k, runMove(st, x, {faint, power}));
      return cache.get(k);
    };
    const winProb = dists => {   // dists: 技ごとの点数分布。M が最大点で選ばれる確率(同点は等分)
      const iM = ms.indexOf(M); let tot = 0;
      for (const [s, q] of dists[iM]){
        let poly = [1];
        for (let j = 0; j < ms.length; j++){ if (j === iM) continue;
          let lt = 0, eq = 0; for (const [s2, q2] of dists[j]){ if (s2 < s) lt += q2; else if (s2 === s) eq += q2; }
          const np = new Array(poly.length + 1).fill(0);
          for (let t = 0; t < poly.length; t++){ np[t] += poly[t] * lt; np[t + 1] += poly[t] * eq; }
          poly = np;
        }
        let w = 0; for (let t = 0; t < poly.length; t++) w += poly[t] / (t + 1);
        tot += q * w;
      }
      return tot;
    };
    // 比較に入らない技(威力1以下・一部の技)は、倒せるかどうかだけ独立に分ける
    const others = ms.filter(x => !cmp.includes(x));
    const otherCases = (fixed, prob) => {   // fixed: Map(move -> {faint, power}) for cmp moves
      let res = 0;
      const rec = (k, pr, cfg) => {
        if (k === others.length){
          const dists = ms.map(x => { const c = cfg.get(x); return scores(x, c.faint, c.power); });
          res += pr * winProb(dists); return;
        }
        const x = others[k];
        if (MV[x].power >= 2){
          const pf = P(x, v => v >= HP);
          if (pf > 0) rec(k + 1, pr * pf, new Map(cfg).set(x, {faint:true, power:'other'}));
          if (pf < 1) rec(k + 1, pr * (1 - pf), new Map(cfg).set(x, {faint:false, power:'other'}));
        } else rec(k + 1, pr, new Map(cfg).set(x, {faint:false, power:'other'}));
      };
      rec(0, prob, fixed);
      return res;
    };
    if (!cmp.length) return otherCases(new Map(), 1);
    // 最大値 v と、v を出す技の集合 B で場合分け
    const allV = [...new Set(cmp.flatMap(x => [...dv[x].keys()]))].sort((a, b) => a - b);
    let total = 0;
    const n = cmp.length;
    for (const v of allV) for (let mask = 1; mask < (1 << n); mask++){
      let pr = 1; const inB = [], outB = [];
      for (let i = 0; i < n; i++){ const x = cmp[i];
        if (mask & (1 << i)){ const q = dv[x].get(v) || 0; pr *= q; inB.push(x); }
        else { outB.push(x); }
      }
      if (pr === 0) continue;
      // B 以外は v 未満。倒せるかどうかで2通り
      const rec = (k, prob, cfg) => {
        if (prob === 0) return;
        if (k === outB.length){ total += otherCases(cfg, prob); return; }
        const x = outB[k];
        const a = P(x, w => w < v && w >= HP), b = P(x, w => w < v && w < HP);
        if (a > 0) rec(k + 1, prob * a, new Map(cfg).set(x, {faint:true, power:'not'}));
        if (b > 0) rec(k + 1, prob * b, new Map(cfg).set(x, {faint:false, power:'not'}));
      };
      const base = new Map(); for (const x of inB) base.set(x, {faint: v >= HP, power:'best'});
      rec(0, pr, base);
    }
    return total;
  }

  // ctx から状態を組み立て、特性・個体値・せんせいのツメで重み付き平均
  function likelihood(m, M, ctx){
    const sp = AI.species[m.sp], it = AI.items[m.item] || ['NONE', 0], o = OUR[ctx.field];
    const nm = AI.natures[m.nature] || [];
    const speStat = iv => {
      const ev = m.evv ? m.evv[5] : (m.evs.includes('SPEED') ? Math.floor(510 / m.evs.length) : 0);
      let v = Math.floor((2 * sp.b[5] + (m.iv ?? iv) + Math.floor(ev / 4)) * 50 / 100) + 5;
      if (nm[0] === 'spe') v = Math.floor(v * 110 / 100); else if (nm[1] === 'spe') v = Math.floor(v * 90 / 100);
      return v;
    };
    const ivs = m.iv != null ? [[m.iv, 1]] : ctx.ivw;
    const abil = sp.a.map(x => [x, 1 / sp.a.length]);
    const qcs = it[0] === 'QUICK_CLAW' ? [[true, it[1] / 100], [false, 1 - it[1] / 100]] : [[false, 1]];
    const g = sp.g < 0 ? [['MON_GENDERLESS', 1]] : [['MON_FEMALE', sp.g], ['MON_MALE', 1 - sp.g]].filter(x => x[1] > 0);
    const us = ctx.userStages;
    let total = 0;
    for (const [ability, pa] of abil) for (const [iv, pi] of ivs) for (const [qc, pq] of qcs){
      const ratio = RAT[(us.spe || 0) + 6];
      let uspe = Math.floor(speStat(iv) * ratio[0] / ratio[1]);
      if ((ability === 'SWIFT_SWIM' && ctx.weather === 'AI_WEATHER_RAIN') || (ability === 'CHLOROPHYLL' && ctx.weather === 'AI_WEATHER_SUN')) uspe *= 2;
      if (it[0] === 'MACHO_BRACE') uspe = Math.floor(uspe / 2);
      if (ctx.userStatus === 'para') uspe = Math.floor(uspe / 4);
      const tr = RAT[(ctx.tgtStages.spe || 0) + 6];
      let tspe = Math.floor(o.spe * tr[0] / tr[1]); if (ctx.tgtStatus === 'para') tspe = Math.floor(tspe / 4);
      const stats = INF.monStats(m, iv);
      const st = {
        mon: m, weather: ctx.weather, turn: ctx.turn,
        user: {moves: m.moves, types: sp.t, ability, hpPct: ctx.userHpPct, status: ctx.userStatus, stages: {...us, acc: 0}, flags: ctx.userFlags,
               side: ctx.userSide, hold: it[0], last: ctx.prevMove, protect: ctx.protectCount, stock: ctx.stock, first: ctx.firstMove,
               party: ctx.userParty, gender: g, speed: uspe, qc},
        tgt: {level: o.level, types: o.types, hp: ctx.hp, hpPct: Math.floor(100 * ctx.hp / o.max), status: ctx.tgtStatus, stages: ctx.tgtStages, flags: ctx.tgtFlags,
              side: ctx.tgtSide, abil: o.abil, gender: o.gender, last: ctx.ourLast, history: ctx.ourHistory || ctx.ourHist || [], first: ctx.tgtFirst,
              party: ctx.ourParty, partyStatus: ctx.ourPartyStatus, speed: tspe},
        dmg: {ability, stats, status: ctx.userStatus === 'burn' ? 'burn' : ctx.userStatus === 'none' ? 'none' : 'poison',
              pinch: ctx.userHpPct <= 33, flashFire: false, weather: ctx.weather === 'AI_WEATHER_RAIN' ? 'rain' : ctx.weather === 'AI_WEATHER_SUN' ? 'sun' : 'none',
              atkStage: us.atk || 0, spaStage: us.spa || 0},
        dtgt: {types: o.types, def: o.def, spd: o.spd, ability: o.abil[0][0], defStage: ctx.tgtStages.def || 0, spdStage: ctx.tgtStages.spd || 0},
        usable: x => ctx.usable(x),
      };
      total += pa * pi * pq * chooseProb(st, M);
    }
    return total;
  }
  return {likelihood, runMove, chooseProb, OUR};
}
if (typeof module !== 'undefined') module.exports = {makeSim};
