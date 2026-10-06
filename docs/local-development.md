# 各PCでの開発と公開

GitHubがDGの共有元。Vaultの元ノート・画像はDropboxで同期し、DGの通常cloneは同期対象外の `Documents/GitHub/hyodo-arch-dg` に置く。

## 初回設定

1. GitHubから通常cloneする。既存フォルダを上書きしない。
2. package.json指定のNode.js 22.xを用意し、`node --version` を確認する。
3. リポジトリのルートで `npm ci` を実行する。
4. テンプレート共通画像の同期が必要な場合だけ、PowerShellで `$env:DG_VAULT_PATH = 'そのPCのVault絶対パス'` を設定する。`.obsidian` を含むVaultルートを指定する。

この環境変数はセッション内だけ有効。常用する場合はWindowsのユーザー環境変数 `DG_VAULT_PATH` を同じ値に設定し、ターミナルや開発ツールを再起動する。PC固有値はGitへ入れない。

`tools/sync-vault.cjs` は `.env` をロードしない。`.env` に書いただけでは設定されない。sync:commonはDG_VAULT_PATHの明示設定が必要。未設定ならコピー前にエラー終了する。sync:vaultのノート同期は廃止済み。

## 普段の作業

- 開始時：Git状態とoriginを確認。cleanでbehindのみならff-onlyで更新する。
- Vaultを使う前にDropbox同期完了を確認する。
- 元ノート・作品画像の追加更新：Vaultで編集し、ユーザーがObsidian DG Publishで公開する。システム側の同期は不要。Publish後、cleanなcloneはfetchとpull --ff-onlyで取得する。
- 表示確認：`npm run dev:local`。表示されたlocalhostのURLを開く。Vault同期は実行しない。取得済みの公開入力だけを表示する。終了はCtrl+C。
- 公開確認：`npm test`、`npm run build`。buildはdistを削除・再生成し、設定されたテーマを取得する。同期はbuild自体には含まれない。
- ソース差分を確認してcommitし、依頼された公開は `git push origin main`。Cloudflareの該当コミット成功と実サイトを確認する。

`src/site/notes/` と `src/site/img/` は公開用入力としてGit管理する。`dist/`、`node_modules/`、生成テーマCSS、`.cache/` は通常Gitへ入れない。`.cache/` に独自資料があるときは保存要否を調べてから整理する。

## テンプレート用の共通画像

バナーなどテンプレートが直接参照する画像は `tools/common-images.json` にVault相対パスで登録する。現在は事務所バナー・Instagram・くらしの道具・無聊写記・共通OGPの5画像。元画像はVaultの `images/` 配下、公開入力はcloneの `src/site/img/`直下 に置き、公開入力もGit管理する。公開URLは `/img/ファイル名`。登録一覧はVault相対パスのままとし、同期時にファイル名を使って配置するため、異なるフォルダの同名ファイル（Windowsの大文字小文字違いを含む）は登録できない。`img/user/` はDGプラグインの未使用画像削除対象のため、テンプレート用画像を置かない。

- 通常dev/buildはVaultを変更・同期しない。ノート同期のsync:vaultは廃止され、誤実行時は変更前にエラーで停止する。
- `DG_VAULT_PATH` を設定して `npm run sync:common` を実行すると、ノートを変更せず共通画像だけを同期する。
- 元画像が欠けている場合はエラーになり、公開入力を削除しない。全登録画像の存在を確認してからコピーする。
- `npm run check:common-images` は公開入力の欠落・空ファイルと、テンプレート・グローバル設定内の `/img/ファイル名` 参照の登録漏れと、旧 `/img/user/images/common/` 参照の残存を検出する。新しい共通画像を追加したら一覧と画像を一緒にGitへ保存する。
- `npm run build` は開始時に同じ検証を実行し、欠落時はdistを削除する前に停止する。VaultがないCloudflareでもGit管理された公開入力だけで検証できる。
- `DG-Publish.cmd` はVault同期を実行しない。画像差し替え後は先に `npm run sync:common` を実行してから公開する。公開時のbuildでも欠落検証が実行される。作品コンテンツはObsidian DG Publishで公開する。DG-Publish.cmdはシステム修正専用で、src/site/notesのMarkdownとsrc/site/img/userの変更があれば停止する。実装はGit管理されたtools/publish-dg.ps1、Vault側はその呼出のみ。

## Google Analytics 4

Measurement IDの登録先はCloudflare Pagesの `hyodo-arch-dg` → Settings → Variables and Secrets（Environment variables）→ Production。変数名を `GA_MEASUREMENT_ID`、値を既存GA4ウェブストリームの `G-` で始まる測定IDにする。実IDをテンプレート・JavaScript・Git管理された `.env` へ書き込まない。登録・変更後は再デプロイが必要。Previewには設定しない。`.env.example` の空欄は設定方法の見本。

DG標準の `dynamics.common.head` で `components/user/common/head/ga4.njk` を自動読込する。データは `src/site/_data/analytics.js` が環境変数から取得する。ID未設定、または `ELEVENTY_ENV` が `prod` 以外ならタグ自体を出力しない。IDが不正な形式ならエラーにする。本番用HTMLをpages.devでも表示できるため、ブラウザでもHTTPSの `www.hyodo-arch.com` だけにGoogleタグの読込を限定する。pages.dev・ローカル・他ドメインではGoogleへのリクエストも計測初期化も行わない。

Googleタグ標準の `config` による通常のページビュー計測を使い、独自イベントや手動のpage_view送信を追加しない。HOME・作品・情報・タグ・404は共通headを一度だけ使用する。ドメイン切替前にIDを登録しても、DGのpages.devは計測しない。切替後にGA4のリアルタイム表示で公開サイトからの受信を確認する。検証ではGoogleタグの通信を捕捉し、実GA4へテストデータを送らない。

### 自分とスタッフのアクセスを除外する

普段使う各端末・各ブラウザー・各プロファイルで、次のURLを開く。ブログ側の設定とは別に登録する。

| 操作 | URL |
| --- | --- |
| このブラウザーを除外 | `https://www.hyodo-arch.com/?analytics=off` |
| 除外を解除 | `https://www.hyodo-arch.com/?analytics=on` |
| 保存状態を確認 | `https://www.hyodo-arch.com/?analytics=status` |

既存のga4.njkが、本番www/HTTPSに限ってlocalStorageの `hyodo-arch-analytics-optout=1` を確認する。除外時はGoogleタグの読込・初期化を行わず、公式の `ga-disable-<Measurement ID>` もtrueにする。IDは既存の環境変数を使う。除外・解除・確認の操作ページ自体も計測しない。正常な通常訪問は従来どおりタグ1個と標準configで計測する。

操作時だけ本文の先頭に結果を表示し、操作用analyticsパラメーターをアドレス欄から除く。残りのクエリ・アンカー・ページパスを保つ。保存・削除後に再読取りできた場合だけ成功を表示し、保存失敗・状態不明でもそのページは計測しない。URL整形の失敗は保存結果と計測停止に影響しない。状態を読めない通常訪問も計測しないため、保存制限のある一般訪問者もこの場合は集計されない。

設定を保存した後は普通のURLで閲覧でき、接続元IPの変更に影響されない。別ブラウザー・プライベート閲覧・保存データ削除後は再設定が必要。Safariには一定期間サイト上の操作がない場合に保存データを削除する仕様があるため、永久保存を保証しない。除外・確認URLをブックマークして、長期間使っていない場合などは確認・再設定する。[WebKitの保存制限](https://webkit.org/tracking-prevention/)

他タブの設定変更と、戻る/進むで復元されたページでも保存状態を再確認し、必要なら公式の送信停止フラグを立てる。解除によって開いたままのページを自動的に再初期化しない。計測を再開する場合は、通常ページを新しく開くか再読込する。設定前に送った履歴や、すでに開始した通信を取り消す機能ではない。[Googleの送信停止仕様](https://developers.google.com/tag-platform/security/guides/privacy#turn_off_google_analytics)

結果表示は独自のuser SCSS `hyodo-analytics.scss` をDG標準の自動検出で読み込む。公開ページのノートや共通レイアウトを編集する必要はない。GA4タグを出力しない開発環境・ID未設定・確認用デプロイでは、本番の除外操作も実行しない。回帰検証は `src/helpers/analytics.test.js` で実テンプレートと保存状態・例外・URL維持・他タブ/ページ復元を検証する。

## headのtitle

ブラウザのtitleは通常ページで「ページタイトル | 事務所名」、トップ（page.urlが `/`）では事務所名のみとする。事務所名は既存の `SITE_NAME_HEADER`（meta.siteName）から取得するため、Cloudflare用の新しい環境変数は不要。既に同じ事務所名が付いた404等には重複して追加しない。

`src/helpers/seo.js` のseoTitleフィルターをindex・note・randomの各レイアウトで使い、headTitleとして既存pageheaderへ渡す。HTMLのtitleと自動生成するog:title・twitter:titleで共用し、HTML出力時にエスケープする。ノートのtitle自体は変更しないため、本文見出し、一覧、検索、feedのタイトルは維持する。DG標準metatagsで明示されたOGP・Twitterタイトルは従来どおり優先する。

## canonical

DG標準のcommon/head拡張で `components/user/common/head/canonical.njk` を一度だけ読み込み、既存 `SITE_BASE_URL` とEleventyの `page.url` から絶対URLを生成する。新しい環境変数・ノートプロパティ・手作業のURL一覧は不要。通常の公開ページ（HOME・作品・情報・カテゴリー・タグ）に出力し、`eleventyExcludeFromCollections` の404・ランダム遷移・検証ページには出力しない。URLの末尾スラッシュや既存.html形式はそのまま保持し、クエリ・フラグメントは除く。

ドメイン移行前の `SITE_BASE_URL=https://hyodo-arch-dg.pages.dev` ではcanonicalを出力しない。本番ドメイン切替時に既存のサイトURLを `https://www.hyodo-arch.com` へ変更し、再ビルド・再デプロイすると有効になる（設定末尾の `/` の有無は両方対応）。sitemap・feed・自動OGPも同じサイトURLを参照する。公開環境だけでなく、各PCのローカル設定も切替時に揃える。現時点でサイトURLやDNSは変更しない。

canonicalのホストは `www.hyodo-arch.com` に限定し、pages.dev・localhost・別ドメインを正規URLとして出力しない。HTTPS以外・認証情報・非標準ポート・サブパス・クエリ等を含む本番サイトURL設定は、ページURL付きのbuildエラーにする。ドメイン切替後にpages.devで同じ本番HTMLを表示しても、canonicalはwwwを指す。

`npm test` と通常buildで検証し、切替後は全公開ページにcanonicalが1個ずつあること、sitemap・og:urlと一致すること、実際のwwwのページがHTTP200で開くことを確認する。canonicalはHTTPリダイレクトとは別の設定で、301やrobots.txtはそれぞれの作業で対応する。

## robots.txt

`src/site/robots.njk` をEleventy標準のpermalinkで `dist/robots.txt` へ生成する。レイアウトを使わないプレーンテキストとし、`eleventyExcludeFromCollections: true` によりsitemap・feed・検索・一覧の対象外にする。distを直接編集せず、このテンプレートをGitで管理する。

`User-agent: *` と `Allow: /` で公開ページの巡回を許可する。Sitemap行は既存の `SITE_BASE_URL` が本番 `https://www.hyodo-arch.com` の場合だけ出力し、既存seoCanonicalフィルターで作ったルートURLへ `sitemap.xml` を付ける。末尾スラッシュあり・なしの両方に対応する。移行前のpages.devや未設定の場合は巡回許可のみ出力し、pages.devのサイトマップは案内しない。新しい環境変数やDNS変更は不要。本番URLへの設定変更・再ビルド後は、次の内容になる。

```text
User-agent: *
Allow: /

Sitemap: https://www.hyodo-arch.com/sitemap.xml
```

通常の `npm test` と `npm run build`、本番サイトURLを環境変数で一時指定した生成結果を確認する。robots.txtの実応答がHTTP200・プレーンテキストであり、robots.txt自体がsitemap/feedへ含まれないことを確認する。ドメイン切替前にpages.devでファイルの出力を確認し、切替後に `https://www.hyodo-arch.com/robots.txt` とSitemap行を再確認する。[Googleのrobots.txt案内](https://developers.google.com/crawling/docs/robots-txt/create-robots-txt)

## 旧URLの301転送

設定と切替手順は [redirects.md](redirects.md) を参照。Cloudflare Pages標準の `_redirects` を使う。通常buildで転送先・重複・ループを検査し、HTTP301はPages上で確認する。wwwのドメイン切替は別作業。

## description・OGP・X/Twitter Card

Vaultのノートプロパティ `description` を、検索用のdescription・og:description・twitter:descriptionへ使用する。DG Publishが保持する `dg-note-properties`（テンプレートのnoteProps）から取得する。複数行は空白に整え、HTML属性をエスケープして出力する。原文は変更しない。未設定・空欄・文字列以外は説明タグを自動生成しない。

画像を固定したいノートでは、次のようにVault相対パスを指定し、Obsidian DG Publishで公開する。パスだけの指定、Obsidianの `[[画像パス]]`、公開済みの `/img/...`、完全なHTTP/HTTPS画像URLに対応する。既存プラグインのプロパティ画像収集を使い、本文へ画像を追加する必要はない。

```yaml
description: "ページの説明"
og-image: images/og/contact.jpg
```

通常の画像選択順は `og-image` → 本文冒頭の画像ブロック → 共通画像。通常画像・Image Captions・スライドショー・Image Grid Captionsは生成済みの本文HTMLから判定し、スライドショー・グリッドは1枚目を使う。見出しや説明文が先にある場合、その後の画像は冒頭画像として扱わない。ナビ・サイドバー・一覧カードは判定対象の本文に含めない。画像表示用の既存処理は変更しない。

共通画像の選択設定は `src/site/_data/seo.js` のdefaultImage。現在の `/img/top-IMGP0361.jpg` は、Vaultの `images/top/top-IMGP0361.jpg` を既存の共通画像同期で `src/site/img/top-IMGP0361.jpg` に配置する。元画像・HOME用の画像はそのまま保持する。共通用はimg/userの外なので、HOMEからの参照やプラグイン管理下のコピーがなくなっても残る。差し替え時は上記のsync:commonを実行し、共通登録・設定・画像を一緒にシステム公開する。

`src/helpers/seo.js` がメタ情報を組み立て、userSetupのseoMetatagsフィルターとDG標準のpageheader内の既存ループで一度だけ出力する。og:title・twitter:titleの自動生成値は上記headTitle、og:typeはwebsite、twitter:cardはsummary_large_image。画像はog:imageとtwitter:imageで共用する。og:url・画像URLはmeta.siteBaseUrl（SITE_BASE_URL）を基準にし、末尾スラッシュによる重複を避ける。サイトURL設定を本番ドメインへ変更すれば次のbuildで追従する。未設定時はDG標準どおり既存metatagsだけを出力する。

DG標準の `dg-metatags` の明示値も維持する。明示og:imageがある場合は冒頭画像・共通画像より優先し、og-imageプロパティもある場合はog-imageを優先する。説明・タイトル・カード形式などの個別メタタグやtwitter:imageが明示されている場合は、その値を維持する。最終的な同名タグは1つだけ。ローカル画像の欠落・空ファイル・不正な参照はページURL付きのbuildエラーにし、共通画像へ黙って置換しない。外部画像URLは構文を確認するが、build中に外部サイトへ画像の取得確認は行わない。

`npm test` と `npm run build` で検証する。公開後はページソースのメタ情報・画像URLの表示と、SNSでの共有カードを確認する。SNS側のキャッシュや表示仕様によって更新時期・切り抜きは異なる。

## 表示検証

### 404ページ

`src/site/404.njk` は既存の `layouts/index.njk` と共通ナビゲーション・スタイルを使う。`permalink: /404.html` により毎回 `dist/404.html` を生成する。[Cloudflare Pagesの標準動作](https://developers.cloudflare.com/pages/configuration/serving-pages/#not-found-behavior)がこのファイルを見つからないURLに適用する。ノートの404.mdや独自リダイレクト設定は不要。

`eleventyExcludeFromCollections: true` によりsitemap・検索・作品一覧に含めず、`robots: noindex, follow` を出力する。feedは既存のnoteコレクションを使用するため、このシステムページを含まない。

404の案内文・見出し・HOMEリンクは `404.njk` のHTMLを編集する。末尾の `{{ collections.gardenEntry | homeSlideshow | safe }}` は、公開済みHOMEの最初のスライドショーだけを再利用する。既存の描画結果・画像・再生設定を使い、HOME本文やNewsは含めない。スライドショー用のJS・CSSも既存の共通レイアウトから読み込む。先頭の `eleventyImport.collections: [gardenEntry]` はHOMEが先に描画される順序とHOME変更時の再生成に必要なため維持する。

写真の追加・削除・並べ替えや再生設定はVaultのHOME内の `slideshow` ブロックで編集し、ユーザーがObsidian DG Publishで公開する。同じ公開入力を使う次のbuildで、トップと404の両方へ反映される。404専用の画像一覧・コピー・Vault同期は不要。HOMEがない・非表示・複数、または有効なスライドショーがない場合はbuildエラーにし、以前の写真へ黙って置き換えない。

以前の `404-sekiguchi.jpg` は404の参照と共通画像登録から外した。既存の写真ファイルは保管してあり、現在の404表示・buildには必要ない。

build後に `node tools/local-verification/check-404.cjs` を実行する。Playwright・Edgeの条件は下記と同じ。トップとの画像・順序・再生設定の一致、ルート・深い階層・クエリ／フラグメント付きの存在しないURL、PC／モバイル表示、スライド切替・自動再生、検索・HOMEリンク・コレクション除外を検証する。`.cache/404-check/` に結果と画面を保存する。ローカル配信はCloudflareの404応答を模しており、実際の公開先でのHTTP 404はpush・デプロイ後に同じコマンドへ `VERIFY_BASE` を指定して確認する。

### 公開ノート

`tools/local-verification/check-site.cjs` は既存distを一時HTTPサーバーで配信し、全公開ノートと和風タグ一覧を1440px・390pxで確認する。画像、横はみ出し、事務所情報、戻るボタン、バックリンク非表示、JSエラーを検査し、`.cache/site-check/` へJSONと代表画面を出力する。サイトソースやVaultは変更しない。

Playwrightが必要。通常のアプリ依存には追加していない。利用可能なPlaywrightパッケージへのパスを環境変数 `PLAYWRIGHT_MODULE` に設定するか、呼び出し元から解決できる `playwright` を用意する。Microsoft Edgeを使い、`BROWSER_CHANNEL` で別チャンネルも指定できる。

```text
node tools/local-verification/check-site.cjs
```

`VERIFY_BASE` を設定すると、そのURLの公開サイトまたは起動済みプレビューを同じ項目で検査する。検証結果の完全一致だけでGitコミット一致を代用しない。

旧検証スクリプトの制約は `tools/local-verification/README.md`、2026年9月の試作・取込スクリプトは `tools/archive/2026-09-local-scripts/README.md` を参照。

## 移行中の扱い

旧Vault配下の `.hyodo-arch-dg-install` は保管用として残し、新cloneと同時に監視を起動しない。職場PCの新clone確認と、旧環境のローカル履歴・未追跡・無視ファイルの保存確認が終わるまで削除しない。削除はDropbox経由で他PCにも反映される。

## Windowsでの起動補助

Node.js 22を他のプロジェクトのNodeと共存させる場合、Windowsのユーザー環境変数 `DG_NODE_PATH` にNode.js 22のnode.exeとnpm.cmdがあるディレクトリを設定する。`DG_VAULT_PATH` とともにPC固有の値なのでGitへ入れない。

リポジトリのルートで次を実行する。起動補助は現在のセッション、未設定ならユーザー環境変数を読み、Node 22を確認する。Vaultの存在確認はsync:commonの場合だけ。システム全体のPATHは変更しない。

```powershell
powershell -ExecutionPolicy Bypass -File tools/local.ps1
powershell -ExecutionPolicy Bypass -File tools/local.ps1 -Task sync:common
powershell -ExecutionPolicy Bypass -File tools/local.ps1 -Task test
powershell -ExecutionPolicy Bypass -File tools/local.ps1 -Task build
powershell -ExecutionPolicy Bypass -File tools/local.ps1 -Task install
```

既定のTaskはdev:local。終了はCtrl+C。初回install、公開前test/buildも同じNodeで実行できる。実行ポリシーの指定はこの起動プロセスだけに適用され、永続的なポリシー変更は行わない。

## 内部リンクとお問い合わせ

移行済みページへの本文リンクは、Vault内の相対Markdownリンク（例：`[辻の家](新築住宅/辻の家.md)`）を使用する。パスに空白があれば%20へ変換し、リンク先を山括弧で囲まない。既存DG Publishの変換とサイト側のresolveMdLinksで、そのノートの公開permalinkへ解決する。写真を包むリンクは埋め込み記法を維持して、リンク先だけ公開ルート相対パス（例：`/house/kagoshima/`）を使用する。ドメインを本文へ固定しない。frontmatterのsource-urlは移行元の記録なので書き換えない。

共通のお問合せボタンはGoogleフォーム `https://forms.gle/qnT5nXuhZ8gBgCHk9` を使用する。本文のフォーム案内も同じ送信先、電話は `tel:0484835999`、メールは `mailto:info@hyodo-arch.com` とする。フォームの送受信はユーザー確認済み。無聊写記は `https://blog.hyodo-arch.com/`。未移行のVectorworks配布サイトは現在 `https://www.hyodo-arch.com/vectorworks/index.html` であり、wwwのDNS切替前に別途公開先を決める必要がある。

本文の修正はVaultだけに保存し、ユーザーのObsidian DG Publishで公開する。システム側から公開入力のノートを置換しない。公開後はNEWS・関連作品・ご依頼ページ・プロフィールのリンクを実サイトで確認する。
