# Slideshow

ノート本文の任意の位置に記述できます。同じページに複数設置可能です。

```slideshow
autoplay: true
speed: 1000
autoPlayDuration: 3000
nav: false
arrow: false

![[images/top/yamate_IGP0510a.jpg]]
![[images/top/yamate_IGP0510a.jpg|画像の説明]]
```

画像は1行に1つ。空行は無視します。png / jpg / jpeg / webp / gif / bmp / avif / svg 対応。画像は既存の画像パス解決処理で `/img/user/` に解決し、DGの画像最適化も使用します。存在しない画像や不正な行はエラー表示します。画像名だけの指定は同名画像があると曖昧になるため、Vaultルートからの完全な相対パスを推奨します。

設定はブロックごとに独立し、省略時は次の値になります。

| 設定 | デフォルト | 意味 |
| --- | --- | --- |
| autoplay | false | 自動再生を開始するか |
| speed | 1000 | フェード時間（ミリ秒）。0は瞬時切替 |
| autoPlayDuration | 3000 | 切替開始から次の切替開始までの時間（ミリ秒） |
| nav | false | 下部ドットの表示 |
| arrow | false | 左右ボタンの表示 |

真偽値は小文字のtrue/false、時間は整数（speedは0以上、autoPlayDurationは1以上、いずれも2147483647以下）。不明な設定・重複・不正な値はエラー表示します。speedが間隔以上だとフェード途中で次の切替が始まるので、通常は間隔より短く指定します。

設定のない既存ブロックも、新しいデフォルトに従って自動再生・ナビゲーションが無効になります。上の例は自動再生だけを有効にした例です。

左右キー（スライドショーにTabでフォーカス）、横スワイプはナビゲーション非表示でも使えます。一時停止・再生ボタンはありません。自動再生はホバー中・フォーカス中・タッチ中・非表示タブでは停止し、解除後に設定間隔を待って再開します。横スワイプが成立したブロックは、ページを再読み込みするまで自動再生を停止します（縦スクロールやタップだけでは恒久停止しません）。OSの動きを減らす設定では自動再生・フェードを止めます。写真全体が見える3:2の枠を本文幅に合わせ、1枚の場合は操作UIを付けません。

実装は `src/helpers/slideshow.js`、`src/site/scripts/slideshow.js`、`src/site/styles/user/slideshow.scss`。`src/helpers/userSetup.js` とユーザー用footerの `slideshow.njk` から登録します。DG標準テンプレート・通常コードブロックは変更しません。

現行公開経路はVault同期→test/build→コミット→mainへの通常pushです。`images/` 以下は既存同期でもコードブロック内からコピーします。新規ノートは同期対象追加が必要です。

Obsidian DG Publishとの互換対応は、Vaultの `.obsidian/plugins/digitalgarden/main.js` にある既存画像収集を `hyodoCodeBlockImagePaths` としてグリッドと共用。使用中画像の保持・アップロード・重複排除・ハッシュ比較を既存処理に任せ、コードブロック本文は維持します。DG更新で消えるローカル修正のため、同ディレクトリの `local-patches/` の差分とテストを保管してください。実Publishは公開操作になるため今回実行しません。反映にはObsidian再起動またはDG再読み込みが必要です。

2026-09-28の設定対応・一時停止ボタン削除はサイト側だけの変更です。Obsidianプラグインは変更していないため、この更新のためのObsidian再起動は不要です。既存の画像収集は設定行を読み飛ばします。

検証: `npm test`、`npm run build`、`node tools/local-verification/check-slideshow.cjs`。最後のコマンドは `PLAYWRIGHT_MODULE` にPlaywrightの場所を設定して実行します。
