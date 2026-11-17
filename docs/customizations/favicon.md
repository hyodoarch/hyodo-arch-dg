# 事務所favicon

確認日：2026-11-17。承認済みの家と4つの窓の画像を採用。窓の位置・寸法・余白・白背景を維持する。

- 元画像はVaultの images/common/hyodoarch-favicon-approved.png。ImageGenで作成し利用者が承認したPNGをそのまま保存。
- src/site/favicon.svg は元画像を512pxに縮小したPNGを自己完結で埋め込むSVG。ベクトルへの描き直しではない。sharpでresize(512,512).png()したバッファをbase64でimage要素へ格納。
- 既存normalize-favicon.jsとserialFaviconsでSVG・ICO（16/32/64px）・Apple（180px）・192/512px PNG・manifestを生成。distは直接編集しない。
- src/site/_includes/components/pageheader.njk はApple背景を白にし、SVG/ICO/Appleの参照にv=20261117を付け、旧ブラウザーキャッシュと区別する。次回変更時も版を更新する。
- 標準favicon.svgとpageheader.njkはDG更新・テンプレート置換で上書きされる可能性がある。失うと旧アイコン・旧背景・旧キャッシュ参照へ戻る。更新時はGit履歴から両ファイルの独自変更を再統合する。独自docsは通常残るが全体置換では保証されない。
- 復元元はhyodoarch/hyodo-arch-dgの本変更のGit履歴とVault元画像。
- 検証：Node22でnpm test、npm run build。生成SVG/ICO/PNGとhead参照を確認。公開後は該当コミットのCloudflare成功、HTTP200と生成物のハッシュ一致を確認する。

- src/helpers/serialFavicons.js は非同期生成完了後にiconVersionをURLへ付与する。Nunjucksのsetブロックでは非同期shortcodeを捕捉できないため、生成コールバック内で処理する。この独自拡張もテンプレート更新時に維持する。
