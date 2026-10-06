# Image Captions / Image Grid Captions

Digital GardenのMarkdown拡張として導入。登録先は `src/helpers/userSetup.js`。CSSは `src/site/styles/user/image-captions.scss`、グリッドのリサイズ・拡大表示は `src/site/scripts/image-grid-captions.js` で読み込む。

## Image Captions

```md
![[images/photo.jpg|説明]]
![[images/photo.jpg|説明|left|312]]
![[images/photo.jpg|説明|right|312]]
![[images/photo.jpg|説明|center|405]]
![説明|405](/img/user/images/photo.jpg)
```

画像だけの段落をfigureとfigcaptionに変換する。left/rightは本文の回り込み、centerは中央配置。通常の `![[images/photo.jpg]]` はキャプションなし。

幅未指定のImage Captions（`++`のaltのみも含む）は、先行する左右画像の回り込みを解除し、本文幅いっぱいで表示する。left/rightだけを指定して幅を省略した場合も同じ。幅指定ありは余白に収まれば横に配置し、収まらなければ先行画像の下へ送る。画像の外枠は独立した整形領域にし、余白へ押し込むための自動縮小を防ぐ。本文幅を超える指定は本文内に収める。600px以下でleft/rightの指定幅を2/3、最大55%にする既存のモバイル対応は維持する。

幅の有無はMarkdown解析時の `image-captions-full-width` クラスで区別する。画像最適化後のimgのwidth属性では判定しない。公開前の表示検証は `node tools/local-verification/check-image-captions.cjs`（Playwrightの指定方法はlocal-development.md参照）。

## Image Grid Captions

````md
```image-grid-captions
columns: 2
gap: 8
![[images/photo1.jpg|
## 外観
外観の説明文です。

### 材料
材料についての説明です。
]]
![[images/photo2.jpg|通常のキャプション]]
```
````

- columnsは2/3/4。1ブロックの画像枚数と一致させる。
- 異なる縦横比の画像も高さを揃え、切り取らずに並べる。狭い画面でも列数を維持する。
- `|` を省略すればキャプションなし。1行キャプションも従来どおり使える。
- `|` から閉じる `]]` まで複数行で書ける。行頭の `## ` / `### ` はH2/H3、通常文は段落。空行で段落を分ける。
- `\## ` / `\### ` は記号として表示。HTML・リンク・太字などのインライン記法は文字のまま表示する。
- 幅・左右配置の指定には対応しない。追加の `|` はエラー。
- 各画像は `src/site/img/user/` 内に公開されている必要がある。例：`images/photo1.jpg` は `src/site/img/user/images/photo1.jpg`。コードブロック内だけの参照はObsidianのDigital Gardenプラグインから自動転送されない場合があるため、画像も公開先へ追加する。

今回、公開済み「関口酒造母屋リノベーション」の8グリッドが参照する未転送画像16枚を補完した。

## 開発・検証

```sh
npm ci
npm test
npm run build
```

ブラウザスクリプトの共通コードを変更したら `node tools/build-image-grid-client.js` を実行する。両機能のfixtureは `IMAGE_CAPTIONS_FIXTURE=true` のときだけ出力される。通常ビルドではテスト用ページやテスト用画像を公開しない。

Image Captionsは `src/helpers/imageCaptions/`、Image Grid Captionsは `src/helpers/imageGridCaptions/` に実装。各ディレクトリのLICENSEを保持する。画像最適化時の引用符などによる属性破損を防ぐため、`.eleventy.js` のpicture生成時にHTML属性をエスケープしている。

## altとキャプション（2026-09-29）

- `![[image.jpg|HOGEHOGE]]`：従来どおり表示し、画像altにもHOGEHOGEを設定。
- `![[image.jpg|++HOGEHOGE]]`：altのみ。先頭の`++`とキャプションは出力しない。
- Image Captionsは`![[image.jpg|++HOGEHOGE|left|317]]`の配置・幅指定も維持。
- Image Grid Captionsの通常キャプションは表示を変えず、altだけ先頭行から見出し・強調・コード・リンク等のMarkdown記号を除去する。複数行の説明全文はaltに入れない。
- グリッドでも`![[image.jpg|++アイランド・キッチン]]`はaltのみ。キャプション未指定時のファイル名altは従来どおり。`++`だけの場合は空alt。
- エスケープされた記号は文字として扱う。本文途中の`++`は従来どおり文字として表示する。
- グリッドの表示は既存仕様（H2/H3と段落、その他のインライン記法は文字表示）を維持。
