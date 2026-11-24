# タワーPPカウンター

エメラルドのバトルタワー(レベル50・50連勝以降)で、相手の型の絞り込みと、ヌケニンに当たる技のPP管理をするWebツール。
自分のパーティは画面の「パーティ登録」で変えられる(初期値はファイヤー・ハガネール・ヌケニン。src/template.html の DEFAULT_PARTY と data.json の ai.our)。

## 構成
- `index.html` … 公開用の完成品(1ファイル。データを埋め込み済み)。**直接編集しない**
- `src/template.html` … 画面とロジックの本体。`__DATA__` の位置にデータが入る
  - 中に `src/sim.js`(COMの技選択の確率計算)と `src/engine.js`(安全側の推理)を**貼り付けた写し**がある。sim.js / engine.js を直したら template.html 内の同じ部分も直す
  - 自分のパーティは `P`(場のキー p0〜p2 → 能力値など)に入り、`makeInfer(D, P)` / `makeSim(D, INF, P)` と共有する。登録を変えると `applyParty` が中身を書き換える
- `src/data.json` … 型・技・トレーナー・リラ・COMのスクリプト(ai.script)などのデータ。パーティ登録用に全386種(ai.species / ai.dex)・全354技(moves)・特性名(ai.abilJa)も入っている
- `build.py` … `python3 build.py` で template + data → index.html
- `data-build/` … data.json を pret/pokeemerald と PokeAPI から作り直すスクリプト(通常は不要)
  - `add_party_data.py` … 全種族・全技・特性名を data.json に足す(既存の値と一致するか確かめながら追加する。使い方はファイルの先頭)
- `tests/` … jsdom での動作確認。`npm i jsdom@24.1.0` の後に実行する
  - `node tests/all_moves.test.js` … 初期のパーティで全種・全技1,455回タップしてエラー0件を確認
  - `node tests/party.test.js` … 別のパーティを登録し、3匹それぞれを場に出して全技タップ(4,365回)。登録の保存・入力チェック・旧版の保存データの読み替えも確認

## 仕様の要点
- 出典は pret/pokeemerald。COMはチェック1→3→2(battle_ai_scripts.s)をそのまま実行
- プレッシャー:場の自分のポケモンの特性がプレッシャーなら、自分以外が対象の技は2減る。カウンター・ミラーコートは既定−1、成功時のみ「成功した −1」
- パーティ登録:入れるのはゲームのステータス画面の実数値(HP・防御・特防・素早さ)とレベル・特性・性別・技。攻撃・特攻は COM の技選択に関係しないので持たない
- 色分け(弱点):ふしぎなまもりのポケモンがいれば「そのポケモンに当たる技」と間接技、いなければ「場の自分のポケモンに効果抜群の技」
- 素早さの比較は、場に出ている自分のポケモン(能力ランクとまひを反映)が相手
- COMは相手(自分側)の特性を知らない:特性が2つある種族は毎回どちらかを当てずっぽうで選ぶ(かげふみ・じりょく・ありじごくだけは見抜く)。sim.js は確率で、engine.js は両方の場合を範囲で扱う
- 交代したターンの相手の技は交代前のポケモンを見て選ばれる
- 状態は localStorage(キー tower-pp-counter-v1)に、パーティの登録は別キー(tower-pp-counter-party-v1)に保存。旧版の場のキー(moltres など)は読み込み時に p0〜p2 へ読み替える
- 文言の名前は日本語版ROMの表記

## 修正の流れ
1. src/ を直す → 2. `python3 build.py`(Windows では `python build.py`) → 3. `node tests/all_moves.test.js` と `node tests/party.test.js` → 4. コミットして push(GitHub Pages に自動反映)
