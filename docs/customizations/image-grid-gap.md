# 画像グリッドの可変gap

2026-11-20。DG公開サイトのImage Grid Captionsでは、スマホで固定18pxが広すぎるため、画面幅ではなく画像グリッドの実幅Wに合わせて間隔を縮める。Obsidianプラグイン・Quartzは別管理で、今回変更しない。

## 仕様

Markdownのgap（非負整数、省略時8）を最大値Gとして扱う。

- W ≤ 375px：G / 2。
- 375px < W < 720px：G × (0.5 + 0.5 × (W − 375) / 345)。
- W ≥ 720px：G。

`gap: 18` は9〜18px、8は4〜8px、0は0px。小数を丸めず、画像寸法計算とCSSのgapに同じ値を使う。720px以上で18pxを維持するため、本文736pxのタブレットも従来どおり。PCでも右メニューで本文が縮むと実幅に追従する。999／1000pxの既存レイアウト切替では本文幅自体が変わるため、それに応じてgapも変わる。時間方向のCSS transitionは加えない。

2／3／4列・画像の縦横比・高さ合わせ・スマホのキャプション左余白9pxは維持する。作品ノートや公開入力の変更は不要。極端に大きいgapや狭すぎる幅では既存のエラー表示を維持する。

## 対象と復元

通常clone `C:/Users/hyodo/Documents/GitHub/hyodo-arch-dg` のルート相対パス。

| 対象 | 役割 |
| --- | --- |
| `src/helpers/imageGridCaptions/shared/layout.js` | DG用の可変gap計算と、小数gapを受け付ける画像寸法計算 |
| `src/helpers/imageGridCaptions/shared/renderer.js` | ResizeObserverで実幅を取得し、同じ適用gapで画像と隙間を更新 |
| `src/site/scripts/image-grid-captions.js` | 配信用の生成JS。直接編集しない |
| `src/helpers/imageGridCaptions/shared/layout.test.js` | 境界・連続性・各列数の寸法・異常入力を検証 |
| `tools/local-verification/check-image-grid-gap.cjs` | 実ページとブラウザー内fixtureによる寸法・操作検証 |
| `docs/image-captions.md`、本書、`docs/customizations/README.md` | 記法・復元・検証の記録 |

独自実装・独自資料のため通常残るが保証ではない。本体更新・再インストール・フォルダー置換・Obsidian/Quartz共通コードの再取り込みで上書きされうる。生成JSは再生成でも上書きされるため、layoutとrendererを組で復元する。失われるとスマホでも18px固定に戻るか、画像寸法と隙間が食い違う。

2026-11-20に公開依頼を受領。ソース・検証・資料を同じcommitで保管し、そのcommitを今回版の復元元とする。公開コミットとCloudflareの成功・本番確認結果はVaultの運用記録・変更台帳に記録する。`node tools/build-image-grid-client.js` で配信JS、Node22の `npm run build` でdistを再生成する。`tools/build-image-grid-client.js` 自体は変更不要。

## 検証

Node22で `npm test` → `npm run build` を実行し、Playwrightが利用できる環境で以下を実行する。

```powershell
$env:PLAYWRIGHT_MODULE = 'C:/Users/hyodo/Documents/GitHub/obsidian-image-grid-captions/node_modules/@playwright/test'
node tools/local-verification/check-image-grid-gap.cjs
```

Playwrightは既存のローカル導入先を利用し、通常依存には追加しない。既定ブラウザーはMicrosoft Edge、`BROWSER_CHANNEL` で変更可能。アイコン・検索等の既存CDN依存を読み込むためネットワーク接続が必要。Google Analytics等の計測通信はブラウザー検証時に遮断する。

PH-6×6・本蓮の家を320〜1440px、375／720px付近・674／675px・999／1000px・スマホ→PCの復帰で確認する。2／3／4列、gap 0／8／18、縦横混在画像のfixtureはブラウザー内だけに作成し、ノート・画像を公開入力へ追加しない。メイン幅だけを変える条件も確認する。

実測・画面は `.cache/image-grid-gap-check/` に出力する一時生成物。Safari・実機は別途確認が必要。

## 検証結果（2026-11-20）

- Node22.23.3で657テスト（31ファイル）成功。公開用buildは132ファイル生成、ads.txt検証成功。既存の循環依存に関する警告あり。
- Microsoft Edgeで139条件成功。PH-6×6・本蓮の家の各20条件（画面幅320〜1440pxと戻し操作）、ブラウザー内fixtureの99条件（2／3／4列×gap 0／8／18×実幅11条件）。全グリッドの適用gap・高さ合わせ・縦横比・右端一致、実ページの横はみ出しなし、スマホのキャプション左余白9pxを確認。両ページの拡大表示とEscapeで閉じる操作も成功。
- 375pxのPH-6×6・本蓮の家、1440pxのPH-6×6、768pxの本蓮の家をスクリーンショットで目視確認。375pxでgap9px、768pxでは本文736px・gap18px、1440pxでは本文858px・gap18px。実測結果は同出力先のresults.json、画面6枚。CDN依存を読み込んだ最終検証で未捕捉ブラウザー例外なし。
- 上記は実装時のローカル検証結果。本番確認結果は公開後にVaultの運用記録・変更台帳へ記録する。実機・Safariでの検証は未実施。
