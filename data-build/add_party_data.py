"""自分のパーティ登録用に、data.json へ全386種・全354技・特性名を足す。

使い方: python data-build/add_party_data.py <取得したファイルを置いたフォルダ>
フォルダには次の9ファイルを置く(ファイル名はそのまま)。
  pret/pokeemerald: include/constants/moves.h, src/data/battle_moves.h, src/data/pokemon/species_info.h
  PokeAPI data/v2/csv: pokemon_species_names.csv, move_names.csv, ability_names.csv, type_names.csv は不要
既にある188技・141種は、作り直した値と一致することを確かめてから上書きしない(差があれば止まる)。
"""
import csv, json, re, sys
from pathlib import Path

SRC = Path(sys.argv[1])
ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'src' / 'data.json'
read = lambda n: (SRC / n).read_text(encoding='utf-8')
norm = lambda s: re.sub(r"[\s\-\.\'’_]", '', s).lower()


def names(csv_name, id_col, lang):
    out = {}
    with open(SRC / csv_name, encoding='utf-8') as f:
        for r in csv.DictReader(f):
            if r['local_language_id'] == str(lang):
                out[int(r[id_col])] = r['name']
    return out


sp_en, sp_ja = names('pokemon_species_names.csv', 'pokemon_species_id', 9), names('pokemon_species_names.csv', 'pokemon_species_id', 1)
mv_ja = names('move_names.csv', 'move_id', 1)
ab_en, ab_ja = names('ability_names.csv', 'ability_id', 9), names('ability_names.csv', 'ability_id', 1)
sp_by = {norm(sp_en[i]): (i, sp_ja[i]) for i in sp_en if i in sp_ja and i <= 386}
sp_by['nidoranf'] = (29, 'ニドラン♀'); sp_by['nidoranm'] = (32, 'ニドラン♂')
ab_by = {norm(ab_en[i]): ab_ja[i] for i in ab_en if i in ab_ja}

d = json.loads(DATA.read_text(encoding='utf-8'))
TY_JA = {v['typeEn']: v['type'] for v in d['moves'].values()}

# ---------- 技 ----------
move_id = {m: int(v) for m, v in re.findall(r'#define (MOVE_\w+)\s+(\d+)', read('moves.h'))}
added_moves = 0
for name, body in re.findall(r'\[(MOVE_\w+)\]\s*=\s*\{(.*?)\n    \}', read('battle_moves.h'), re.S):
    g = lambda k: re.search(r'\.' + k + r'\s*=\s*([^,\n]+),', body).group(1)
    mid = move_id[name]
    if mid == 0 or mid not in mv_ja:
        continue
    ty = g('type').replace('TYPE_', '')
    if ty not in TY_JA:
        continue          # ???タイプ(のろい)は既存データ側で扱い済み。未収録なら飛ばす
    new = dict(ja=mv_ja[mid], type=TY_JA[ty], typeEn=ty, power=int(g('power')), acc=int(g('accuracy')), pp=int(g('pp')),
               effect=g('effect').replace('EFFECT_', ''), target=g('target').replace('MOVE_TARGET_', ''),
               priority=int(g('priority')), c=name.replace('MOVE_', ''))
    old = d['moves'].get(str(mid))
    if old is not None:
        assert old == new, f'技 {mid} が既存データと違います:\n{old}\n{new}'
    else:
        d['moves'][str(mid)] = new; added_moves += 1

# ---------- 種族 ----------
GENDER = {'MON_MALE': 0, 'MON_FEMALE': 1, 'MON_GENDERLESS': -1}
species, order = d['ai']['species'], {}
abil_ja, added_sp = {}, 0
for const, body in re.findall(r'\[(SPECIES_\w+)\]\s*=\s*\{\s*\n(.*?)\n    \}', read('species_info.h'), re.S):
    key = norm(const.replace('SPECIES_', ''))
    if key not in sp_by:
        continue
    dex, ja = sp_by[key]
    t = re.search(r'\.types\s*=\s*\{\s*TYPE_(\w+),\s*TYPE_(\w+)\s*\}', body).groups()
    b = {k: int(re.search(r'\.base' + k + r'\s*=\s*(\d+)', body).group(1)) for k in ['HP', 'Attack', 'Defense', 'SpAttack', 'SpDefense', 'Speed']}
    a = [x for x in re.search(r'\.abilities\s*=\s*\{\s*ABILITY_(\w+),\s*ABILITY_(\w+)\s*\}', body).groups() if x != 'NONE']
    gr = re.search(r'\.genderRatio\s*=\s*([^,\n]+),', body).group(1).strip()
    pf = re.match(r'PERCENT_FEMALE\(([\d.]+)\)', gr)
    # 実機は min(254, 百分率×255÷100) を性別のしきい値にする。既存データと同じ「メスの割合」で持つ
    g = GENDER[gr] if gr in GENDER else float(pf.group(1)) / 100
    new = dict(c=const.replace('SPECIES_', ''), t=sorted(set(t), key=t.index), b=list(b.values()), a=a, g=g)
    old = species.get(ja)
    if old is not None:
        cmp = dict(new); cmp['g'] = old['g'] if abs(old['g'] - new['g']) < 0.01 else new['g']
        assert old == cmp, f'{ja} が既存データと違います:\n{old}\n{new}'
    else:
        species[ja] = new; added_sp += 1
    order[ja] = dex
    for x in a:
        abil_ja[x] = ab_by[norm(x)]

d['ai']['dex'] = order                      # 図鑑番号(登録画面の並び順用)
d['ai']['abilJa'] = dict(sorted(abil_ja.items()))
DATA.write_text(json.dumps(d, ensure_ascii=False, separators=(',', ':')), encoding='utf-8', newline='\n')
print(f'技 +{added_moves} (計{len(d["moves"])}) / 種族 +{added_sp} (計{len(species)}) / 特性名 {len(abil_ja)}')
bad = [k for k in species if not re.search(r'[ァ-ヶ]', k)] + [v['ja'] for v in d['moves'].values() if not re.search(r'[ぁ-ヶ]', v['ja'])]
print('日本語名が付かなかったもの', bad)
