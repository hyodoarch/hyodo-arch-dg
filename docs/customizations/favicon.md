# 事務所favicon

確認日：2026-11-17。承認済みの家と4つの窓の画像を採用。窓と家の比率・白背景を維持する。2026-11-17の実寸確認を受け、外側の余白を除き家を表示枠の最大サイズへ拡大。

- 元画像はVaultの images/common/hyodoarch-favicon-approved.png。ImageGenで作成し利用者が承認したPNGをそのまま保存。
- src/site/favicon.svg は元画像を512pxに縮小したPNGを自己完結で埋め込むSVG。ベクトルへの描き直しではない。sharpでresize(512,512).png()したバッファをbase64でimage要素へ格納。
- 既存normalize-favicon.jsとserialFaviconsでSVG・ICO（16/32/64px）・Apple（180px）・192/512px PNG・manifestを生成。distは直接編集しない。
- src/site/_includes/components/pageheader.njk はApple背景を白にし、SVG/ICO/Appleの参照にv=20261117-2を付け、旧ブラウザーキャッシュと区別する。次回変更時も版を更新する。
- 標準favicon.svgとpageheader.njkはDG更新・テンプレート置換で上書きされる可能性がある。失うと旧アイコン・旧背景・旧キャッシュ参照へ戻る。更新時はGit履歴から両ファイルの独自変更を再統合する。独自docsは通常残るが全体置換では保証されない。
- 復元元はhyodoarch/hyodo-arch-dgの本変更のGit履歴とVault元画像。
- 今回の検証は利用者指定によりfaviconの見え方のみ。全体テスト・ローカルの全体ビルドは実施しない。公開生成はCloudflareで行う。

- src/helpers/serialFavicons.js は非同期生成完了後にiconVersionをURLへ付与する。Nunjucksのsetブロックでは非同期shortcodeを捕捉できないため、生成コールバック内で処理する。この独自拡張もテンプレート更新時に維持する。

- 最大表示のviewBoxは `143.5 142 235 235`。埋込PNGの家の外接範囲を正方形で切り出し、アンチエイリアス用に片側1pxのみ残す。PNG自体は変更しない。Appleの追加余白も0にする。
