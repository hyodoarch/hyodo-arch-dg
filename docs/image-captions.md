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

画像だけの段落をfigureとfigcaptionに変換する。キャプション付きのleft/rightは本文の回り込み、centerは中央配置。通常の `![[images/photo.jpg]]` はキャプションなし。キャプションなしのleft/rightと、モバイルで指定幅を2/3にする対応は今回の導入には含まれない。

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
