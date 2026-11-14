import json, re
exec(open('build_data.py').read().split('# ---------- フロンティアのポケモン')[0])
src = read(f'{PE}/src/frontier_util.c')
tower = src[src.index('[FRONTIER_FACILITY_TOWER] =\n    {'):src.index('[FRONTIER_FACILITY_DOME] =\n    {')]
blocks = re.findall(r'\.species = (SPECIES_\w+),\s*\.heldItem = (ITEM_\w+),\s*\.fixedIV = (\w+),\s*\.nature = NATURE_(\w+),\s*\.evs = \{([^}]*)\},\s*\.moves = \{([^}]*)\}', tower)
assert len(blocks) == 6
d = json.load(open('tower_data.json'))
brain = {'silver': [], 'gold': []}
for k, (sp, item, iv, nat, evs, mvs) in enumerate(blocks):
    e = [int(x) for x in evs.split(',')]          # HP,Atk,Def,Spe,SpA,SpD
    mv = re.findall(r'MOVE_\w+', mvs)
    s = SPECIES[sp]
    for x in mv:
        m = MOVES[x]
        d['moves'][str(m['id'])] = dict(ja=m['ja'], type=ty_by.get(norm(m['type'])), typeEn=m['type'], power=m['power'], acc=m['acc'],
                                         pp=m['pp'], effect=m['effect'], target=m['target'], priority=m['priority'])
    key = 'silver' if k < 3 else 'gold'
    brain[key].append(dict(id=9000+k, sp=sp_ja_name(sp), set='金' if key=='gold' else '銀', brain=key,
        types=[ty_by.get(norm(x), x) for x in s['types']], moves=[MOVES[x]['id'] for x in mv],
        item=it_by.get(norm(item.replace('ITEM_','')), item), nature=na_by.get(norm(nat)),
        evs=[], evv=[e[0], e[1], e[2], e[4], e[5], e[3]], iv=31 if iv == 'MAX_PER_STAT_IVS' else int(iv),
        base={'Speed': s['base']['Speed']}, rate=0))
d['brain'] = brain
for m in d['mons']: m['base'] = {'Speed': m['base']['Speed']}
json.dump(d, open('tower_data_full.json','w'), ensure_ascii=False, separators=(',',':'))
for k,v in brain.items():
    for m in v: print(k, m['sp'], m['item'], m['nature'], m['evv'], m['iv'], [d['moves'][str(x)]['ja'] for x in m['moves']])
