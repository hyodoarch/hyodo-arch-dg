# Slideshow

ノート本文の任意の位置に記述できます。同じページに複数設置可能です。

```slideshow
![[images/top/yamate_IGP0510a.jpg]]
![[images/top/yamate_IGP0510a.jpg|画像の説明]]
```

画像は1行に1つ。空行は無視します。png / jpg / jpeg / webp / gif / bmp / avif / svg 対応。画像は既存の画像パス解決処理で `/img/user/` に解決し、DGの画像最適化も使用します。存在しない画像や不正な行はエラー表示します。画像名だけの指定は同名画像があると曖昧になるため、Vaultルートからの完全な相対パスを推奨します。

5秒間隔、650msのフェード。左右ボタン、左右キー、ドット、横スワイプで操作できます。写真全体が見える3:2の枠を本文幅に合わせます。1枚の場合は操作UIを付けません。自動再生は一時停止可能で、ホバー中・操作部へのフォーカス中・タッチ中・非表示タブでは停止します。OSの動きを減らす設定では自動再生・フェードを止めます。

実装は `src/helpers/slideshow.js`、`src/site/scripts/slideshow.js`、`src/site/styles/user/slideshow.scss`。`src/helpers/userSetup.js` とユーザー用footerの `slideshow.njk` から登録します。DG標準テンプレート・通常コードブロックは変更しません。

現行公開経路はVault同期→test/build→コミット→mainへの通常pushです。`images/` 以下は既存同期でもコードブロック内からコピーします。新規ノートは同期対象追加が必要です。

Obsidian DG Publishとの互換対応は、Vaultの `.obsidian/plugins/digitalgarden/main.js` にある既存画像収集を `hyodoCodeBlockImagePaths` としてグリッドと共用。使用中画像の保持・アップロード・重複排除・ハッシュ比較を既存処理に任せ、コードブロック本文は維持します。DG更新で消えるローカル修正のため、同ディレクトリの `local-patches/` の差分とテストを保管してください。実Publishは公開操作になるため今回実行しません。反映にはObsidian再起動またはDG再読み込みが必要です。

検証: `npm test`、`npm run build`、`node tools/local-verification/check-slideshow.cjs`。最後のコマンドは `PLAYWRIGHT_MODULE` にPlaywrightの場所を設定して実行します。
