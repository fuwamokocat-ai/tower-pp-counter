"""pokeemerald + PokeAPI から、バトルタワー(51連勝以降・Lv50)の出現データを作る。"""
import csv, json, re, random, collections, sys

PE = '/tmp/pokeemerald'
PA = '/tmp/pokeapi/data/v2/csv'

def read(p):
    return open(p, encoding='utf-8').read()

# ---------- PokeAPI 名前 ----------
def names(csv_name, id_col, lang):
    out = {}
    with open(f'{PA}/{csv_name}', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            if r['local_language_id'] == str(lang):
                out[int(r[id_col])] = r['name']
    return out

def norm(s):
    return re.sub(r"[\s\-\.\'’_]", '', s).lower()

sp_en, sp_ja = names('pokemon_species_names.csv', 'pokemon_species_id', 9), names('pokemon_species_names.csv', 'pokemon_species_id', 1)
mv_en, mv_ja = names('move_names.csv', 'move_id', 9), names('move_names.csv', 'move_id', 1)
it_en, it_ja = names('item_names.csv', 'item_id', 9), names('item_names.csv', 'item_id', 1)
na_en, na_ja = names('nature_names.csv', 'nature_id', 9), names('nature_names.csv', 'nature_id', 1)
ty_en, ty_ja = names('type_names.csv', 'type_id', 9), names('type_names.csv', 'type_id', 1)

sp_by = {norm(sp_en[i]): sp_ja[i] for i in sp_en if i in sp_ja and i <= 386}
sp_by.update({'nidoranf': 'ニドラン♀', 'nidoranm': 'ニドラン♂'})
it_by = {norm(it_en[i]): it_ja[i] for i in it_en if i in it_ja}
it_by.update({'stick': 'ながねぎ', 'brightpowder': 'ひかりのこな', 'silverpowder': 'ぎんのこな',
              'blackglasses': 'くろいメガネ', 'nevermeltice': 'とけないこおり', 'twistedspoon': 'まがったスプーン',
              'deepseatooth': 'しんかいのキバ', 'deepseascale': 'しんかいのウロコ'})
na_by = {norm(na_en[i]): na_ja[i] for i in na_en if i in na_ja}
ty_by = {norm(ty_en[i]): ty_ja[i] for i in ty_en if i in ty_ja}

# ---------- 技 ----------
moves_h = read(f'{PE}/include/constants/moves.h')
move_id = {m: int(v) for m, v in re.findall(r'#define (MOVE_\w+)\s+(\d+)', moves_h)}
bm = read(f'{PE}/src/data/battle_moves.h')
MOVES = {}
for name, body in re.findall(r'\[(MOVE_\w+)\]\s*=\s*\{(.*?)\n    \}', bm, re.S):
    g = lambda k: (re.search(r'\.' + k + r'\s*=\s*([^,\n]+),', body) or [None, None])[1]
    mid = move_id[name]
    MOVES[name] = dict(
        id=mid,
        ja=mv_ja.get(mid, name),
        type=g('type').replace('TYPE_', ''),
        power=int(g('power')), acc=int(g('accuracy')), pp=int(g('pp')),
        effect=g('effect').replace('EFFECT_', ''),
        target=g('target').replace('MOVE_TARGET_', ''),
        priority=int(g('priority')),
    )

# ---------- 種族 ----------
si = read(f'{PE}/src/data/pokemon/species_info.h')
SPECIES = {}
for name, body in re.findall(r'\[(SPECIES_\w+)\]\s*=\s*\{(.*?)\n    \}', si, re.S):
    t = re.search(r'\.types\s*=\s*\{\s*TYPE_(\w+),\s*TYPE_(\w+)\s*\}', body)
    if not t:
        continue
    stats = {k: int(re.search(r'\.base' + k + r'\s*=\s*(\d+)', body).group(1))
             for k in ['HP', 'Attack', 'Defense', 'Speed', 'SpAttack', 'SpDefense']}
    SPECIES[name] = dict(types=sorted(set(t.groups()), key=t.groups().index), base=stats)

def sp_ja_name(const):
    key = norm(const.replace('SPECIES_', ''))
    return sp_by.get(key, const)

# ---------- フロンティアのポケモン ----------
fm_const = read(f'{PE}/include/constants/battle_frontier_mons.h')
fmon_id = {m: int(v) for m, v in re.findall(r'#define (FRONTIER_MON_\w+)\s+(\d+)', fm_const)}
HIGH_TIER = int(re.search(r'FRONTIER_MONS_HIGH_TIER\s+(\d+)', fm_const).group(1))

bt = read(f'{PE}/src/battle_tower.c')
item_table = dict(re.findall(r'\[(BATTLE_FRONTIER_ITEM_\w+)\]\s*=\s*(ITEM_\w+)', bt))

fmh = read(f'{PE}/src/data/battle_frontier/battle_frontier_mons.h')
EV_BITS = ['HP', 'ATTACK', 'DEFENSE', 'SPEED', 'SP_ATTACK', 'SP_DEFENSE']
MONS = {}
for name, body in re.findall(r'\[(FRONTIER_MON_\w+)\]\s*=\s*\{(.*?)\n    \}', fmh, re.S):
    sp = re.search(r'\.species\s*=\s*(SPECIES_\w+)', body).group(1)
    mv = re.findall(r'MOVE_\w+', re.search(r'\.moves\s*=\s*\{(.*?)\}', body).group(1))
    item = item_table[re.search(r'\.itemTableId\s*=\s*(\w+)', body).group(1)]
    evs = re.findall(r'F_EV_SPREAD_(\w+)', re.search(r'\.evSpread\s*=\s*([^\n]+)', body).group(1))
    nat = re.search(r'\.nature\s*=\s*NATURE_(\w+)', body).group(1)
    m = re.search(r'_(\d)$', name)
    MONS[fmon_id[name]] = dict(
        id=fmon_id[name], const=name, sp=sp, setNo=int(m.group(1)) if m else 1,
        moves=[x for x in mv if x != 'MOVE_NONE'], item=item, evs=evs, nature=nat,
    )

# ---------- トレーナー(200〜299) ----------
# cpp で展開済みのファイル(/tmp/tm_pp.c)から読む
tm = read('/tmp/tm_pp.c')
arrays = {}
for aname, body in re.findall(r'const u16 (gBattleFrontierTrainerMons_\w+)\[\]\s*=\s*\{(.*?)\};', tm, re.S):
    arrays[aname] = [int(x) for x in re.findall(r'-?\d+', body) if int(x) >= 0]

tr_const = read(f'{PE}/include/constants/battle_frontier_trainers.h')
trainer_id = {m: int(v) for m, v in re.findall(r'#define (FRONTIER_TRAINER_\w+)\s+(\d+)', tr_const)}
trs = read(f'{PE}/src/data/battle_frontier/battle_frontier_trainers.h')
TRAINERS = {}
for tname, body in re.findall(r'\[(FRONTIER_TRAINER_\w+)\]\s*=\s*\{(.*?)\n    \}', trs, re.S):
    tid = trainer_id[tname]
    ms = re.search(r'\.monSet\s*=\s*(\w+)', body).group(1)
    cls = re.search(r'\.facilityClass\s*=\s*FACILITY_CLASS_(\w+)', body).group(1)
    TRAINERS[tid] = dict(id=tid, name=tname.replace('FRONTIER_TRAINER_', ''), cls=cls, mons=arrays[ms])

POOL = [TRAINERS[i] for i in range(200, 300)]
# Lv50 では HIGH_TIER より上は出ない
for t in POOL:
    t['valid'] = [m for m in t['mons'] if m <= HIGH_TIER]

# ---------- 出現率(実際の抽選手順をそのままシミュレーション) ----------
random.seed(1)
N = 300000
cnt = collections.Counter()
for _ in range(N):
    t = POOL[random.randrange(100)]
    ms = t['mons']
    chosen = []
    while len(chosen) < 3:
        mid = ms[random.randrange(len(ms))]
        if mid > HIGH_TIER:
            continue
        m = MONS[mid]
        if any(MONS[c]['sp'] == m['sp'] for c in chosen):
            continue
        if m['item'] != 'ITEM_NONE' and any(MONS[c]['item'] == m['item'] for c in chosen):
            continue
        chosen.append(mid)
    for c in chosen:
        cnt[c] += 1

# ---------- 出力 ----------
used_ids = sorted({m for t in POOL for m in t['valid']})
used_moves = sorted({mv for i in used_ids for mv in MONS[i]['moves']} | {'MOVE_STRUGGLE'})

def item_ja(it):
    return it_by.get(norm(it.replace('ITEM_', '')), it)

out_mons = []
for i in used_ids:
    m = MONS[i]
    s = SPECIES[m['sp']]
    out_mons.append(dict(
        id=i, sp=sp_ja_name(m['sp']), set=m['setNo'],
        types=[ty_by.get(norm(x), x) for x in s['types']],
        moves=[MOVES[x]['id'] for x in m['moves']],
        item=item_ja(m['item']), nature=na_by.get(norm(m['nature']), m['nature']),
        evs=m['evs'], base=s['base'],
        rate=round(cnt[i] / N * 100, 3),  # 1戦あたりの出現率(%)
    ))

out_moves = {}
for name in used_moves:
    mv = MOVES[name]
    out_moves[mv['id']] = dict(ja=mv['ja'], type=ty_by.get(norm(mv['type']), mv['type']), typeEn=mv['type'],
                               power=mv['power'], acc=mv['acc'], pp=mv['pp'], effect=mv['effect'],
                               target=mv['target'], priority=mv['priority'])

out_trainers = [dict(id=t['id'], name=t['name'], cls=t['cls'], mons=t['valid']) for t in POOL]

data = dict(mons=out_mons, moves=out_moves, trainers=out_trainers,
            meta=dict(source='pret/pokeemerald', pool='Battle Tower 49勝以降 (trainer 200-299), Lv50', sims=N))
json.dump(data, open('/home/claude/tower_data.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

# ---------- チェック ----------
unmapped = [m['sp'] for m in out_mons if not re.search(r'[ァ-ヶ]', m['sp'])]
unmapped += [m['item'] for m in out_mons if m['item'].startswith('ITEM_')]
unmapped += [v['ja'] for v in out_moves.values() if v['ja'].startswith('MOVE_')]
print('mons', len(out_mons), 'species', len({m['sp'] for m in out_mons}), 'moves', len(out_moves))
print('unmapped', sorted(set(unmapped)))
print('trainer set sizes', min(len(t['mons']) for t in out_trainers), max(len(t['mons']) for t in out_trainers))
