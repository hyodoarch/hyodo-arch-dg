# 事務所favicon

確認日：2026-11-17。承認済みの家と4つの窓の画像を採用。家の形と最大表示を維持し、利用者による窓の間隔拡大・外側の透明化を反映。2026-11-17の実寸確認を受け、外側の余白を除き家を表示枠の最大サイズへ拡大。

- 現行の元データはVaultの images/common/hyodoarch-favicon.svg。家の輪郭はpath、窓はrectで描く純粋なベクターSVG。元の承認済みPNGは参照資料として保持。
- src/site/favicon.svg はVaultの元SVGと同一。PNGの埋込み・外部画像・フォント依存はない。色は濃茶 #281e18、家の外側は透明・内側は白。利用者がInkscapeで窓の間隔を広げて保存したSVGをそのまま使用。
- 既存normalize-favicon.jsとserialFaviconsでSVG・ICO（16/32/64px）・Apple（180px）・192/512px PNG・manifestを生成。distは直接編集しない。
- src/site/_includes/components/pageheader.njk はApple背景を白にし、SVG/ICO/Appleの参照にv=20261117-4を付け、旧ブラウザーキャッシュと区別する。次回変更時も版を更新する。
- 標準favicon.svgとpageheader.njkはDG更新・テンプレート置換で上書きされる可能性がある。失うと旧アイコン・旧背景・旧キャッシュ参照へ戻る。更新時はGit履歴から両ファイルの独自変更を再統合する。独自docsは通常残るが全体置換では保証されない。
- 復元元はhyodoarch/hyodo-arch-dgの本変更のGit履歴とVault元画像。
- 今回の検証は利用者指定によりfaviconの見え方のみ。全体テスト・ローカルの全体ビルドは実施しない。公開生成はCloudflareで行う。

- src/helpers/serialFavicons.js は非同期生成完了後にiconVersionをURLへ付与する。Nunjucksのsetブロックでは非同期shortcodeを捕捉できないため、生成コールバック内で処理する。この独自拡張もテンプレート更新時に維持する。

- 最大表示のviewBoxは `350 347 578 578`。外周にごく小さい描画余白を取り、窓・家の比率と最大表示を維持する。Appleの追加余白は0。
