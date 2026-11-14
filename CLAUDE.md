# タワーPPカウンター

エメラルドのバトルタワー(レベル50・50連勝以降)で、相手の型の絞り込みと、ヌケニンに当たる技のPP管理をするWebツール。
パーティはファイヤー・ハガネール・ヌケニン(能力値・技は src/template.html の ME / OUR と data.json の ai.our)。

## 構成
- `index.html` … 公開用の完成品(1ファイル。データを埋め込み済み)。**直接編集しない**
- `src/template.html` … 画面とロジックの本体。`__DATA__` の位置にデータが入る
  - 中に `src/sim.js`(COMの技選択の確率計算)と `src/engine.js`(安全側の推理)を**貼り付けた写し**がある。sim.js / engine.js を直したら template.html 内の同じ部分も直す
- `src/data.json` … 型・技・トレーナー・リラ・COMのスクリプト(ai.script)などのデータ
- `build.py` … `python3 build.py` で template + data → index.html
- `data-build/` … data.json を pret/pokeemerald と PokeAPI から作り直すスクリプト(通常は不要)
- `tests/` … jsdom での動作確認。`npm i jsdom@24.1.0` の後 `node tests/all_moves.test.js`(全種・全技1,455回タップしてエラー0件を確認)

## 仕様の要点
- 出典は pret/pokeemerald。COMはチェック1→3→2(battle_ai_scripts.s)をそのまま実行
- プレッシャー:ファイヤー相手で自分以外が対象の技は2減る。カウンター・ミラーコートは既定−1、成功時のみ「成功した −1」
- 交代したターンの相手の技は交代前のポケモンを見て選ばれる
- 状態は localStorage(キー tower-pp-counter-v1)に保存
- 文言の名前は日本語版ROMの表記

## 修正の流れ
1. src/ を直す → 2. `python3 build.py` → 3. `node tests/all_moves.test.js` → 4. コミットして push(GitHub Pages に自動反映)
