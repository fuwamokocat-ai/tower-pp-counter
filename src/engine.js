// ===== COMの技選択から型を絞る推理エンジン (エメラルド / バトルフロンティアのAI: チェック1→3→2) =====
// 「観測した技Mが、この型では最大点になりえない」ことを、取りうる全状態について確かめる。
// 安全側: 分からない状態は全パターンを試し、1つでも M が選ばれうるなら除外しない。
// P: 自分のパーティ。場のキー(p0〜p2) → {name, types, hp, def, spd, spe, level, ability, guess, gender, moves}
//    ability は実際の特性、guess は COM が推測しうる特性の一覧(特性が2つある種族は毎回どちらかを当てずっぽうで選ぶ)
function makeInfer(D, P){
  const AI = D.ai, MV = D.moves;
  const PHYS = new Set(['NORMAL','FIGHTING','FLYING','POISON','GROUND','ROCK','BUG','GHOST','STEEL']);
  const RATIO = [[10,40],[10,35],[10,30],[10,25],[10,20],[10,15],[10,10],[15,10],[20,10],[25,10],[30,10],[35,10],[40,10]];
  const ME = P;
  const SELF_STAT = new Set(['ATTACK_UP','ATTACK_UP_2','SPECIAL_ATTACK_UP','SPECIAL_ATTACK_UP_2','CALM_MIND','DRAGON_DANCE','BULK_UP',
    'CURSE','BELLY_DRUM','ATTACK_UP_HIT','ALL_STATS_UP_HIT','OVERHEAT','SUPERPOWER','PSYCH_UP','MEMENTO']);
  const PINCH = {OVERGROW:'GRASS', BLAZE:'FIRE', TORRENT:'WATER', SWARM:'BUG'};
  const T = s => s; // type ids are english consts

  function stat(base, iv, ev, natMod, key){
    let v = Math.floor((2*base + iv + Math.floor(ev/4)) * 50 / 100) + 5;
    if (natMod[0] === key) v = Math.floor(v*110/100);
    else if (natMod[1] === key) v = Math.floor(v*90/100);
    return v;
  }
  function monStats(m, iv){
    const sp = AI.species[m.sp], nm = AI.natures[m.nature] || [];
    const ev = k => m.evv ? m.evv[{atk:1,spa:3}[k]] : (m.evs.includes({atk:'ATTACK',spa:'SP_ATTACK'}[k]) ? Math.floor(510/m.evs.length) : 0);
    if (m.iv != null) iv = m.iv;
    return {atk: stat(sp.b[1], iv, ev('atk'), nm, 'atk'), spa: stat(sp.b[3], iv, ev('spa'), nm, 'spa')};
  }
  function effMuls(type, defTypes){
    const out = [];
    for (const [a, d, m] of AI.chart){
      if (a !== type) continue;
      if (d === defTypes[0]) out.push(m);
      if (d === defTypes[1] && defTypes[0] !== defTypes[1]) out.push(m);
    }
    return out;
  }
  function effClass(type, defTypes){ // 0 / 5 / 10 / 20 / 40 (x10)
    let e = 10; for (const m of effMuls(type, defTypes)) e = e * m / 10; return e;
  }
  // CalculateBaseDamage + TypeCalc (AI用: 急所なし・乱数なし)
  function damage(m, mid, st, tgt){
    const mv = MV[mid], ai = AI.moves[mid], sp = AI.species[m.sp];
    const type = mv.typeEn; let power = mv.power;
    let {atk, spa} = st.stats;
    const it = AI.items[m.item] || ['NONE', 0];
    if (st.ability === 'HUGE_POWER' || st.ability === 'PURE_POWER') atk *= 2;
    if (it[0] === type + '_POWER'){ if (PHYS.has(type)) atk = Math.floor(atk*(it[1]+100)/100); else spa = Math.floor(spa*(it[1]+100)/100); }
    if (it[0] === 'CHOICE_BAND') atk = Math.floor(150*atk/100);
    if (it[0] === 'DEEP_SEA_TOOTH' && sp.c === 'CLAMPERL') spa *= 2;
    if (it[0] === 'LIGHT_BALL' && sp.c === 'PIKACHU') spa *= 2;
    if (it[0] === 'THICK_CLUB' && (sp.c === 'CUBONE' || sp.c === 'MAROWAK')) atk *= 2;
    if (tgt.ability === 'THICK_FAT' && (type === 'FIRE' || type === 'ICE')) spa = Math.floor(spa/2);
    if (st.ability === 'HUSTLE') atk = Math.floor(150*atk/100);
    if (st.ability === 'GUTS' && st.status !== 'none') atk = Math.floor(150*atk/100);
    if (PINCH[st.ability] === type && st.pinch) power = Math.floor(150*power/100);
    let def = tgt.def, spd = tgt.spd;
    if (tgt.ability === 'MARVEL_SCALE' && tgt.status && tgt.status !== 'none') def = Math.floor(150*def/100);
    if (mv.effect === 'EXPLOSION') def = Math.floor(def/2);
    let d;
    if (PHYS.has(type)){
      const r = RATIO[st.atkStage+6], rd = RATIO[tgt.defStage+6];
      d = Math.floor(atk*r[0]/r[1]) * power * 22;
      d = Math.floor(d / Math.floor(def*rd[0]/rd[1]));
      d = Math.floor(d/50);
      if (st.status === 'burn' && st.ability !== 'GUTS') d = Math.floor(d/2);
      if (tgt.reflect) d = Math.floor(d/2);
      if (d === 0) d = 1;
    } else {
      const r = RATIO[st.spaStage+6], rd = RATIO[tgt.spdStage+6];
      d = Math.floor(spa*r[0]/r[1]) * power * 22;
      d = Math.floor(d / Math.floor(spd*rd[0]/rd[1]));
      d = Math.floor(d/50);
      if (tgt.lightScreen) d = Math.floor(d/2);
      if (st.weather === 'rain'){ if (type==='FIRE') d = Math.floor(d/2); if (type==='WATER') d = Math.floor(15*d/10); }
      if (st.weather === 'sun'){ if (type==='FIRE') d = Math.floor(15*d/10); if (type==='WATER') d = Math.floor(d/2); }
      if (st.flashFire && type === 'FIRE') d = Math.floor(15*d/10);
    }
    d += 2;
    if (sp.t.includes(type)) d = Math.floor(d*15/10);
    for (const mul of effMuls(type, tgt.types)){ const before = d; d = Math.floor(d*mul/10); if (d === 0 && mul !== 0) d = 1; }
    return d;
  }
  // ---- AIスクリプトの評価(条件分岐は、分かるものだけ決め、分からないものは両方たどる) ----
  const SC = AI.script, SL = SC.lines, LB = SC.labels;
  const STATN = {STAT_ATK:'ATK',STAT_DEF:'DEF',STAT_SPEED:'SPEED',STAT_SPATK:'SPATK',STAT_SPDEF:'SPDEF',STAT_ACC:'ACC',STAT_EVASION:'EVASION'};
  const lv = a => a === 'DEFAULT_STAT_STAGE' ? 6 : a === 'MIN_STAT_STAGE' ? 0 : a === 'MAX_STAT_STAGE' ? 12 : +a;
  const memo = new Map();
  function statCond(op, who, stat, val, facts){
    const r = facts[(who === 'AI_USER' ? 'U_' : 'T_') + STATN[stat]];
    if (!r) return null;
    const test = x => { x += 6; return op === 'if_stat_level_more_than' ? x > val : op === 'if_stat_level_less_than' ? x < val : op === 'if_stat_level_equal' ? x === val : x !== val; };
    let t = 0, f = 0; for (let x = r[0]; x <= r[1]; x++) test(x) ? t++ : f++;
    return f === 0 ? true : t === 0 ? false : null;
  }
  function scr(start, eff, move, facts, fkey){
    const key = start + '|' + eff + '|' + move + '|' + fkey;
    if (memo.has(key)) return memo.get(key);
    const local = new Map();
    const go = (i, seen) => {
      if (seen.has(i) || i >= SL.length) return [0,0];
      if (local.has(i)) return local.get(i);
      seen.add(i);
      const [op, ...a] = SL[i]; let r;
      const both = (j) => { const x = go(j, seen), y = go(i+1, seen); return [Math.min(x[0],y[0]), Math.max(x[1],y[1])]; };
      if (op === 'end') r = [0,0];
      else if (op === 'score'){ const v = parseInt(a[0]); const x = go(i+1, seen); r = [x[0]+v, x[1]+v]; }
      else if (op === 'goto') r = go(LB[a[0]], seen);
      else if (op === 'call'){ const c = scr(LB[a[0]], eff, move, facts, fkey), x = go(i+1, seen); r = [c[0]+x[0], c[1]+x[1]]; }
      else if (op === 'if_effect' || op === 'if_not_effect'){ const hit = (a[0] === eff) === (op === 'if_effect'); r = hit ? go(LB[a[1]], seen) : go(i+1, seen); }
      else if (op === 'if_move' || op === 'if_not_move'){ const hit = (a[0] === move) === (op === 'if_move'); r = hit ? go(LB[a[1]], seen) : go(i+1, seen); }
      else if (op === 'if_target_is_ally') r = go(i+1, seen);
      else if (op.startsWith('if_stat_level_')){
        const c = statCond(op, a[0], a[1], lv(a[2]), facts);
        r = c === true ? go(LB[a[3]], seen) : c === false ? go(i+1, seen) : both(LB[a[3]]);
      }
      else if (op.startsWith('if_')){ const lab = [...a].reverse().find(x => x in LB); r = lab ? both(LB[lab]) : go(i+1, seen); }
      else r = go(i+1, seen);
      seen.delete(i); local.set(i, r); return r;
    };
    const r = go(start, new Set());
    memo.set(key, r); return r;
  }
  function makeFacts(m, ctx){
    const f = {T_DEF:[ctx.defStage||0, ctx.defStage||0], T_SPDEF:[ctx.spdStage||0, ctx.spdStage||0], T_EVASION:[ctx.evaStage||0, ctx.evaStage||0],
               T_ATK:[-6, Math.max(0, ctx.atkStage||0)], T_SPATK:[-6, Math.max(0, ctx.spaStage||0)], T_SPEED:[-6, Math.max(0, ctx.speStage||0)], T_ACC:[-6,0]};
    const it = AI.items[m.item] || ['NONE',0];
    const ber = {ATTACK_UP:'ATK', DEFENSE_UP:'DEF', SPEED_UP:'SPEED', SP_ATTACK_UP:'SPATK', SP_DEFENSE_UP:'SPDEF'}[it[0]];
    const us = ctx.userStages, key = {ATK:'atk', DEF:'def', SPEED:'spe', SPATK:'spa', SPDEF:'spd', EVASION:'eva'};
    for (const k of ['ATK','DEF','SPEED','SPATK','SPDEF','ACC','EVASION']){
      if (us){ const v = k === 'ACC' ? 0 : (us[key[k]] || 0); f['U_' + k] = [v, k === ber ? Math.min(6, v + 1) : v]; }
      else f['U_' + k] = ctx.selfStatUsed ? [-6,6] : (k === ber ? [0,1] : [0,0]);
    }
    return [f, JSON.stringify(f)];
  }
  const c2r = (mid, facts, fk) => scr(LB.AI_CheckViability, 'EFFECT_' + MV[mid].effect, 'MOVE_' + MV[mid].c, facts, fk);
  const c1r = (mid, facts, fk) => scr(LB.AI_CheckBadMove_CheckEffect, 'EFFECT_' + MV[mid].effect, 'MOVE_' + MV[mid].c, facts, fk);
  const inCmp = mid => MV[mid].power > 1 && !AI.moves[mid].ign;
  // チェック1(攻撃技の共通部分 + ぼうおん + HighRiskForDamage)。相手の特性は COM の推測なので、推測しうる特性すべての結果を範囲にまとめる
  const SOUND = new Set();
  for (let i = LB.AI_CheckBadMove_CheckSoundproof; i < LB.AI_CheckBadMove_CheckEffect; i++) if (SL[i][0] === 'if_move') SOUND.add(SL[i][1]);
  const ABSORB = {VOLT_ABSORB:'ELECTRIC', WATER_ABSORB:'WATER', FLASH_FIRE:'FIRE'};
  function c1(mid, tgt, facts, fk){
    const mv = MV[mid], ai = AI.moves[mid];
    const e = effClass(mv.typeEn, tgt.types);
    const generic = inCmp(mid) || mv.c === 'FISSURE' || mv.c === 'HORN_DRILL';
    const guess = tgt.guess && tgt.guess.length ? tgt.guess : [tgt.ability];
    const outs = [];
    let cont = !generic;          // 共通部分で打ち切られずに先へ進む場合があるか
    if (generic){
      if (e === 0) return [-10,-10];
      for (const a of guess){
        if (ABSORB[a] === mv.typeEn) outs.push([-12,-12]);
        else if (a === 'WONDER_GUARD' && e !== 20) outs.push([-10,-10]);
        else if (a === 'LEVITATE' && mv.typeEn === 'GROUND') outs.push([-10,-10]);
        else cont = true;
      }
    }
    if (cont){
      let cont2 = true;
      if (SOUND.has('MOVE_' + mv.c)){ cont2 = false; for (const a of guess){ if (a === 'SOUNDPROOF') outs.push([-10,-10]); else cont2 = true; } }
      if (cont2){
        if (ai.c1 === 'hr'){
          if (e === 0) outs.push([-10,-10]);
          else for (const a of guess) outs.push(a === 'WONDER_GUARD' && e !== 20 ? [-10,-10] : [0,0]);
        } else outs.push(c1r(mid, facts, fk));
      }
    }
    return [Math.min(...outs.map(x => x[0])), Math.max(...outs.map(x => x[1]))];
  }
  function states(m, ctx){
    const sp = AI.species[m.sp];
    const out = [];
    const ivs = m.iv != null ? [m.iv] : [...new Set(ctx.ivs)];
    const hasPhys = m.moves.some(x => MV[x].power > 1 && PHYS.has(MV[x].typeEn));
    const it = AI.items[m.item] || ['NONE',0];
    let atkSt = [0], spaSt = [0];
    const us = ctx.userStages;
    if (us){ atkSt = [us.atk || 0]; spaSt = [us.spa || 0]; }
    else if (ctx.selfStatUsed){ atkSt = [-6,0,6]; spaSt = [-6,0,6]; }
    // 能力アップのきのみ(HP1/4以下で発動)は、発動したかどうかを両方試す
    if (it[0] === 'ATTACK_UP') atkSt = [...new Set(atkSt.flatMap(v => [v, Math.min(6, v + 1)]))];
    if (it[0] === 'SP_ATTACK_UP') spaSt = [...new Set(spaSt.flatMap(v => [v, Math.min(6, v + 1)]))];
    for (const ability of sp.a) for (const iv of ivs){
      const stats = monStats(m, iv);
      const statuses = ability === 'GUTS' ? ['none','poison','burn'] : (hasPhys ? ['none','burn'] : ['none']);
      for (const status of statuses) for (const pinch of (PINCH[ability] ? [false,true] : [false]))
      for (const flashFire of (ability === 'FLASH_FIRE' ? [false,true] : [false]))
      for (const weather of ctx.weathers) for (const atkStage of atkSt) for (const spaStage of spaSt)
        out.push({ability, stats, status, pinch, flashFire, weather, atkStage, spaStage});
    }
    return out;
  }
  // m: 型, M: 観測した技, ctx: {field, defStage, spdStage, evaStage, atkStage, spaStage, speStage, userStages:{atk,def,spa,spd,spe,eva}, ivs, weathers,
  //   remaining:{mid:pp}, prevMove, firstMove, reflectOpts:[bool..], lightScreenOpts:[bool..]}
  function judge(m, M, ctx){
    if (!m.moves.includes(M) || MV[M].c === 'STRUGGLE') return null;
    const base = ME[ctx.field];
    const tgt = {types: base.types, def: base.def, spd: base.spd, ability: base.ability, guess: base.guess, defStage: ctx.defStage||0, spdStage: ctx.spdStage||0, hp: base.hp};
    // ダメージ計算に効く自分側の状態(リフレクター・ひかりのかべ・ふしぎなうろこ)は、ありうるものを全部試す
    const tgts = [];
    for (const reflect of (ctx.reflectOpts || [false])) for (const lightScreen of (ctx.lightScreenOpts || [false]))
      for (const status of (base.ability === 'MARVEL_SCALE' ? ['none','any'] : ['none'])) tgts.push(Object.assign({}, tgt, {reflect, lightScreen, status}));
    const it = AI.items[m.item] || ['NONE',0];
    if (it[0] === 'CHOICE_BAND' && !ctx.firstMove) return null;
    const shed = base.hp === 1;   // ヌケニン(最大HP1)
    const [facts, fk] = makeFacts(m, ctx);
    const Ss = states(m, ctx);
    const cmp = m.moves.filter(inCmp);
    let best = null;
    for (const X of m.moves){
      if (X === M) continue;
      if (!(ctx.remaining[X] > 0)) continue;
      if (ctx.tormented && X === ctx.prevMove) continue;   // いちゃもん中は直前の技を選べない
      const c1X = c1(X, tgt, facts, fk)[0], c2X = c2r(X, facts, fk)[0];
      const c1M = c1(M, tgt, facts, fk)[1], c2M = c2r(M, facts, fk)[1];
      let ok = true, needHp = 0;
      for (const s of Ss){ if (!ok) break; for (const tg of tgts){
        const dm = {}; for (const y of m.moves) if (MV[y].power > 1) dm[y] = damage(m, y, s, tg);
        const lo = y => Math.max(1, Math.floor(dm[y]*85/100)), hi = y => Math.max(1, dm[y]);
        // X の最低点
        let c3X;
        if (MV[X].power < 2) c3X = 0;
        else if (shed) c3X = AI.moves[X].quick ? 6 : 4;          // ヌケニンはHP1なので必ず「倒せる」
        else if (AI.moves[X].ign) c3X = 0;
        else c3X = cmp.every(y => y === X || lo(X) >= hi(y)) ? 0 : -1;
        // M の最高点
        let c3M;
        if (MV[M].power < 2) c3M = 0;
        else if (shed) c3M = AI.moves[M].quick ? 6 : 4;
        else {
          needHp = Math.max(needHp, hi(M) + 1);   // これより HP が多ければ M では倒せない
          if (AI.moves[M].ign) c3M = 0;
          else {
            const canBest = cmp.every(y => y === M || hi(M) >= lo(y));
            c3M = canBest ? (effClass(MV[M].typeEn, tgt.types) === 40 ? 2 : 0) : -1;
          }
        }
        const minX = 100 + c1X + c3X + c2X, maxM = 100 + c1M + c3M + c2M;
        if (!(minX > maxM)){ ok = false; break; }
      } }
      if (!ok) continue;
      if (!shed && MV[M].power >= 2 && needHp > tgt.hp) continue;   // 満タンでも M で倒せるなら推理できない
      const cand = {X, needHp: (!shed && MV[M].power >= 2) ? needHp : 0, torment: X === ctx.prevMove};
      if (!best || (best.torment && !cand.torment) || (cand.torment === best.torment && cand.needHp < best.needHp)) best = cand;
    }
    return best;
  }
  return {judge, damage, states, ME, SELF_STAT, c2r, makeFacts, monStats, effMuls, inCmp};
}
if (typeof module !== 'undefined') module.exports = {makeInfer};
