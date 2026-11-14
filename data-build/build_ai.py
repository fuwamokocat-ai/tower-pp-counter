import json, re, sys
sys.path.insert(0, '/home/claude/ai')
from parse_ai import ranges, labels, lines, parse
exec(open('/home/claude/build_data.py').read().split('# ---------- フロンティアのポケモン')[0])   # MOVES, SPECIES, read(), PE ...

d = json.load(open('/home/claude/tower_data_full.json'))
const_by_id = {v['id']: k for k, v in MOVES.items()}

# --- チェック1 で HighRiskForDamage に行く効果 ---
cbm_disp = {}
i = labels['AI_CheckBadMove_CheckEffect']
while True:
    op, args = parse(i)
    if op != 'if_effect': break
    cbm_disp[args[0]] = args[1]; i += 1
HR = {e for e, l in cbm_disp.items() if l == 'AI_CBM_HighRiskForDamage'}

IGN = ['EFFECT_EXPLOSION','EFFECT_DREAM_EATER','EFFECT_RAZOR_WIND','EFFECT_SKY_ATTACK','EFFECT_RECHARGE','EFFECT_SKULL_BASH',
       'EFFECT_SOLAR_BEAM','EFFECT_SPIT_UP','EFFECT_FOCUS_PUNCH','EFFECT_SUPERPOWER','EFFECT_ERUPTION','EFFECT_OVERHEAT']
ai_moves = {}
for mid in d['moves']:
    c = const_by_id[int(mid)]; m = MOVES[c]; eff = 'EFFECT_' + m['effect']
    c1 = 'hr' if eff in HR else list(ranges(labels['AI_CheckBadMove_CheckEffect'], eff, c))
    c2 = list(ranges(labels['AI_CheckViability'], eff, c))
    ai_moves[mid] = dict(c1=c1, c2=c2, ign=eff in IGN, quick=eff == 'EFFECT_QUICK_ATTACK')

# --- タイプ相性表(順番どおり) ---
bm = read(f'{PE}/src/battle_main.c')
body = bm[bm.index('gTypeEffectiveness[336]'):]
body = body[:body.index('};')]
chart = re.findall(r'TYPE_(\w+),\s*TYPE_(\w+),\s*TYPE_MUL_(\w+)', body)
mul = {'NO_EFFECT': 0, 'NOT_EFFECTIVE': 5, 'NORMAL': 10, 'SUPER_EFFECTIVE': 20}
# TYPE_FORESIGHT の位置
fs = body.index('TYPE_FORESIGHT')
pre = len(re.findall(r'TYPE_MUL_', body[:fs]))
chart = [[a, b, mul[c]] for a, b, c in chart]
# --- 種族(能力・特性) ---
si = read(f'{PE}/src/data/pokemon/species_info.h')
abil = {}
for name, b in re.findall(r'\[(SPECIES_\w+)\]\s*=\s*\{(.*?)\n    \}', si, re.S):
    a = re.search(r'\.abilities\s*=\s*\{\s*ABILITY_(\w+),\s*ABILITY_(\w+)\s*\}', b)
    if a: abil[name] = [x for x in a.groups() if x != 'NONE']
ja2const = {}
for c in SPECIES:
    ja2const[sp_ja_name(c)] = c
species = {}
for m in d['mons'] + d['brain']['gold'] + d['brain']['silver']:
    c = ja2const[m['sp']]
    s = SPECIES[c]
    species[m['sp']] = dict(c=c.replace('SPECIES_',''), t=s['types'], b=[s['base'][k] for k in ['HP','Attack','Defense','SpAttack','SpDefense','Speed']], a=abil[c])
# --- 持ち物の効果 ---
items_h = read(f'{PE}/src/data/items.h')
hold = {}
for name, b in re.findall(r'\[(ITEM_\w+)\]\s*=\s*\{(.*?)\n    \}', items_h, re.S):
    h = re.search(r'\.holdEffect\s*=\s*HOLD_EFFECT_(\w+)', b); p = re.search(r'\.holdEffectParam\s*=\s*(\d+)', b)
    if h: hold[name] = [h.group(1), int(p.group(1)) if p else 0]
item_ja2const = {}
for name in hold:
    item_ja2const[it_by.get(norm(name.replace('ITEM_','')), name)] = name
items = {}
for m in d['mons'] + d['brain']['gold'] + d['brain']['silver']:
    if m['item'] in item_ja2const: items[m['item']] = hold[item_ja2const[m['item']]]
    else: print('item?', m['item'])
# move type/const
for mid in d['moves']:
    d['moves'][mid]['c'] = const_by_id[int(mid)].replace('MOVE_','')
d['ai'] = dict(moves=ai_moves, chart=chart, foresightAt=pre, species=species, items=items)
json.dump(d, open('/home/claude/tower_data_full.json','w'), ensure_ascii=False, separators=(',',':'))
# report
import collections
nz = {MOVES[const_by_id[int(k)]]['ja']: (v['c1'], v['c2']) for k, v in ai_moves.items() if MOVES[const_by_id[int(k)]]['power'] > 1 and (v['c2'] != [0,0] or v['c1'] not in ([0,0],))}
print(len(ai_moves), 'damaging moves w/ nonzero ranges:', len(nz)); print(nz)
print('species', len(species), 'items', items)
print(chart[:3], pre, len(chart))
