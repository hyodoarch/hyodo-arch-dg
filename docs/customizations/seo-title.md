# HOMEのタイトルと説明文

確認日：2026-11-19。トップの検索・ブラウザー用タイトルをVaultのHOME.mdで管理する。

## 変更対象

- `src/helpers/seo.js`：seoTitleの第4引数にHOME用タイトルを受け取り、page.urlが `/` の場合だけ使用。文字列の空白を整え、空欄・文字列以外なら既存の事務所名を使用する。
- `src/site/_includes/layouts/index.njk` と `src/site/_includes/layouts/note.njk`：noteProps.sitetitleを渡す。headTitleはHTML titleと自動OGP・Twitterタイトルで共用する。明示metatagsの優先順位は維持。
- `src/helpers/seo.test.js`：実テンプレートによるHOMEと他ページの出力・description・フォールバック・属性エスケープ・明示OGPを検証。
- `docs/local-development.md`、この資料と `docs/customizations/README.md`：仕様と復元手順。

## 原稿と公開

Vaultの `HOME.md` に `sitetitle` と `description` を記述する。DGプラグインは両プロパティを `dg-note-properties` に格納する。descriptionは既存処理で検索用・OGP・Twitterの説明文へ反映する。本文・共通の事務所名・一覧・検索・feedのタイトルは変更しない。プラグイン改修・環境変数の追加は不要。

原稿はユーザーがDG Publishする。通常cloneの `src/site/notes/HOME.md` をVaultから直接置換しない。システム変更の公開と原稿のPublishは別途行い、公開後に本番HTMLのtitle・og:title・twitter:title・3種類のdescriptionを確認する。

## 更新・復元

既存ヘルパー・標準レイアウトはDG更新、再インストール、フォルダー置換で上書きされる可能性がある。失うとHOMEのsitetitleが無視される。テストや独自資料は通常残るが保証ではない。復元元はこの機能を追加したGitコミットと以後の履歴。変更箇所を再統合し、単に古いテンプレート全体を戻さない。

Node22で `npm test`、`npm run build`、`npm run check:ads-txt` を実行する。HOMEプロパティが未Publishのbuildでは従来タイトルになる。新プロパティは実テンプレートの回帰テストで検証し、Publish後に本番反映を確認する。Vaultの元ノートは通常のDG更新対象外。同期競合・手動置換時の復元元はDropbox履歴。

2026-11-19：ユーザーのDG Publishコミット `37a177b`（HOMEプロパティ・カテゴリー5件）を、承認されたpull --ff-onlyで取得。Node22.23.3で645テスト・通常build・ads.txt検証成功。生成HTMLのHOMEタイトル、3種類の説明文、OGP・Twitterタイトル、canonical、カテゴリー5件の見出し・タイトル、代表作品のタイトルを照合した。検証結果は `.cache/home-seo-local-results.json`。

システム変更は `78ac59bc9d754d4f48f9ab9c992e7f91105df44f` としてmainへcommit・通常push済み。同コミットのCloudflare Pagesデプロイ `09703d77-dd71-4c16-9963-be59ba930cf6` は2026-11-19 16:58 JSTに成功。本番wwwのHOMEで承認されたsitetitle、検索用・OGP・Twitterのdescription、OGP・Twitterタイトル、canonicalが各1個で期待値と一致することをHTTP取得で確認。カテゴリー5件と本蓮の家はHTTP200、既存のタイトル形式とcanonicalを維持。カテゴリー5件の新見出し、wwwあり／なし両方のads.txtも確認。結果は `.cache/home-seo-live-results.json`。ブラウザー操作は環境エラーで利用できず、本番HTMLを読み取り検証した。画面の目視確認・検索結果への再クロール反映は今回の確認対象外。復元元は上記システムコミットとこの資料の以後の履歴。
