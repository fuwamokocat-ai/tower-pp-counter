"""battle_ai_scripts.s から、技ごとにチェック1・チェック2の補正の取りうる範囲を求める(条件分岐は両方たどる)。"""
import re, json, sys, functools
SRC = open('/tmp/pokeemerald/data/battle_ai_scripts.s').read().split('\n')
labels, lines = {}, []
for raw in SRC:
    l = raw.split('@')[0].rstrip()
    if not l.strip(): continue
    m = re.match(r'^(\w+)::?\s*$', l.strip()) if not raw.startswith('\t') and not raw.startswith(' ') else None
    if m:
        labels[m.group(1)] = len(lines); continue
    lines.append(l.strip())

TERMINAL = {'end'}
def parse(i):
    s = lines[i]; parts = s.split(None, 1)
    op = parts[0]; args = [a.strip() for a in parts[1].split(',')] if len(parts) > 1 else []
    return op, args

def ranges(start, effect, move, depth=0):
    """returns (lo, hi) of score sum from start until end/return."""
    sys.setrecursionlimit(100000)
    memo = {}
    def go(i, stack_guard=()):
        if i in stack_guard: return (0, 0)
        if i in memo: return memo[i]
        if i >= len(lines): return (0, 0)
        op, args = parse(i)
        g = stack_guard + (i,)
        if op == 'end': r = (0, 0)
        elif op == 'score':
            v = int(args[0].replace('+', '')); a = go(i+1, g); r = (a[0]+v, a[1]+v)
        elif op == 'goto': r = go(labels[args[0]], g)
        elif op == 'call':
            c = ranges(labels[args[0]], effect, move, depth+1); a = go(i+1, g); r = (c[0]+a[0], c[1]+a[1])
        elif op in ('if_effect', 'if_not_effect'):
            hit = (args[0] == effect) == (op == 'if_effect')
            r = go(labels[args[1]], g) if hit else go(i+1, g)
        elif op in ('if_move', 'if_not_move'):
            hit = (args[0] == move) == (op == 'if_move')
            r = go(labels[args[1]], g) if hit else go(i+1, g)
        elif op == 'if_target_is_ally': r = go(i+1, g)
        elif op.startswith('if_') and args and args[-1] in labels:
            a = go(labels[args[-1]], g); b = go(i+1, g); r = (min(a[0], b[0]), max(a[1], b[1]))
        elif op.startswith('if_') and any(a in labels for a in args):
            lab = [a for a in args if a in labels][-1]
            a = go(labels[lab], g); b = go(i+1, g); r = (min(a[0], b[0]), max(a[1], b[1]))
        else: r = go(i+1, g)
        memo[i] = r; return r
    return go(start)

if __name__ == '__main__':
    print(ranges(labels['AI_CheckViability'], 'EFFECT_HIT', 'MOVE_TACKLE'))
    print(ranges(labels['AI_CheckViability'], 'EFFECT_SPEED_DOWN_HIT', 'MOVE_ICY_WIND'))
    print(ranges(labels['AI_CheckViability'], 'EFFECT_TOXIC', 'MOVE_TOXIC'))
    print(ranges(labels['AI_CheckViability'], 'EFFECT_FLINCH_HIT', 'MOVE_ROCK_SLIDE'))
    print(ranges(labels['AI_CheckBadMove_CheckEffect'], 'EFFECT_HIT', 'MOVE_TACKLE'))
    print(ranges(labels['AI_CheckBadMove_CheckEffect'], 'EFFECT_FAKE_OUT', 'MOVE_FAKE_OUT'))
    print(ranges(labels['AI_CheckViability'], 'EFFECT_FAKE_OUT', 'MOVE_FAKE_OUT'))
    print(ranges(labels['AI_CheckViability'], 'EFFECT_HIGH_CRITICAL', 'MOVE_SLASH'))
