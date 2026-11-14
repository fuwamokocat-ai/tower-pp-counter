# src/template.html の __DATA__ に src/data.json を埋め込み、index.html を作る
from pathlib import Path
root = Path(__file__).parent
s = (root/'src/template.html').read_text(encoding='utf-8')
d = (root/'src/data.json').read_text(encoding='utf-8').replace('</', '<\\/')
(root/'index.html').write_text(s.replace('__DATA__', d), encoding='utf-8')
print('index.html を作りました')
