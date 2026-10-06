# 旧サイトURLの301転送

設定元は `src/site/_redirects`。Cloudflare Pages標準の仕組みを使い、`src/helpers/userSetup.js` のpassthroughCopyで `dist/_redirects` へ配置する。HTMLやJavaScriptの転送ページ、Apacheの.htaccessは追加しない。

参照：[Cloudflare Pages Redirects](https://developers.cloudflare.com/pages/configuration/redirects/)。633行は完全一致606行・ブログのページ送り24行・旧3区分の一括転送3行で、すべて明示的に301。完全一致、ページ送り、旧区分の一括転送の順に置く。

## 本体サイト

公開済みノートの `dg-note-properties.source-url` と実際のpermalinkから48行を確定。作品ジャンルが異なるため `/projects/*` の一括置換は使わない。新旧で同じ `/`、`/consultation/`、`/office_info/` はそのまま公開し、自己転送しない。

| 旧URL | 新URL・扱い |
| --- | --- |
| `/projects/honbasu.html` | `/house/honbasu/` |
| `/projects/soka.html` | `/house-reno/soka/` |
| `/projects/h-matsu.html` | `/house-reno/h-matsu/` |
| `/projects/sugito.html` | `/kominka-reno/sekiguchi/` |
| `/projects/yamashita.html` | `/apt-reno/yamashita/` |
| `/projects/sherry.html` | `/shop-office/sherry/` |
| `/plain_hut/ph-6x6.html` | `/house/ph-6x6/` |
| `/office_info/concept.html` | `/office_info/consept/`（既存DG URLを保持） |
| `/news.html` | `/news/` |
| `/projects/`、`/projects` | `/house/`（2026-10-02ユーザー指定） |
| `/old_house_renos/`、`/old_house_renos` | `/kominka-reno/` |
| `/office/`、`/office` | `/shop-office/` |
| `/contact.html` | `/consultation/`。Googleフォームへの既存案内・共通ボタンを利用 |
| `/progress`、`/progress/`、`/progress/` 配下 | `/`（2026-10-06ユーザー指定） |

progressは、2026-10-06の指定に合わせて事務所トップへまとめる。既存5件の個別設定も同じ宛先へ変更した。画像・本文・permalinkは変更しない。本体の転送先はルート相対なので、pages.devでは同じpages.dev内で検証でき、www切替後は同じwww内で転送される。

2026-10-02取得の旧sitemap58 URLは、47 URLに301、3 URLは同じ場所で公開、残る8 URLは下記の非公開保管6ページ・旧送信完了・旧404資料。sitemap外の移行済みURLもsource-urlから登録済み。

## 旧ブログ：既存558行を維持し、未対応分を追加

www配下の `/buryoshaki/` に対する旧サーバーの転送も、wwwをPagesへ切り替えると引き継がれない。旧WordPress記事ID253件を公開中の `https://blog.hyodo-arch.com/` の個別記事へ直接転送する。末尾スラッシュあり・なしの506行に、トップ・プロフィール・カテゴリ／タグ・旧ページ送り52行を加えた。

旧転送表の保管元：`C:/Users/hyodo/Dropbox/Projects_Dropbox/04_WEB/兵藤事務所/buryoshaki/.htaccess`。これは古い302テスト版であり、現サーバー設定と同一とは判断しない。宛先は `Documents/GitHub/buryoshaki/content` の `old_url`・記事IDと、公開中のブログsitemap・各宛先のHTTP200を照合して確定した。ブログ側のソース・公開内容は変更しない。

旧表の大文字や旧題名をコピーせず、現行の公開URLを使う。記事番号を新URLへ付けるワイルドカード転送は使わない。カテゴリの旧ページ送りは現行のカテゴリ／タグ一覧へ集約する。

2026-10-06のユーザー指定により、個別記事・一覧・ページ送りに一致しない `/buryoshaki/` 配下はブログトップへ転送する。未対応記事ID `121, 130, 155, 597, 612, 619, 622, 628, 648, 652, 659`、旧画像・WordPress添付・未知の旧ブログURLを含む。画像URLの宛先もブログのHTMLページであり、旧画像ファイルを移行する対応ではない。

## Vectorworks

`/vectorworks`、`/vectorworks/` とその配下は `https://blog.hyodo-arch.com/vectorscript/` へ転送する。旧ページから参照されていた `/assets/files/` の8件のZIP URLも個別に同じページへ転送する。配布ファイルそのものを移行する対応ではなく、現在の案内ページへ誘導する。

一括転送は `/vectorworks/*`、`/buryoshaki/*`、`/progress/*` の3区分と指定された固定宛先だけを許可する。既存の個別記事・ページ送りを優先し、隣接する別名のURLや他の作品・ファイルへ広げない。`/assets/files/*` やサイト全体の一括転送は追加しない。

## 転送しないURL

| URL・対象 | 理由・必要な対応 |
| --- | --- |
| `/arch_link.html`、`/plain_hut/`、`/plain_hut/about_ph.html`、`/plain_hut/ph-5x7.html`、`/plain_hut/ph-4x8.html`、`/plain_hut/ph-spec.html` | Vaultの `_メモ置場/未移行/` に非公開で保管。公開対応先がなく、DGでは404。PH-6×6へ別モデルをまとめて転送しない |
| `/thankyou.html` | 移行しない旧フォームの送信完了ページ。送信成功と誤認する表示を作らず404 |
| `/unused/404page.html`、上記3区分以外の不明URL | 公開対応先がない。共通404を使用 |

## 継続して検証する方法

Node 22で通常の `npm test`、`npm run build` を実行する。通常build完了時にも検査し、コピー漏れ、重複元URL、301以外、Cloudflareの制限超過、現在の公開URLの上書き、ループ・多段転送、非公開宛先・HTML欠落、登録済み転送とsource-url／permalinkの不一致をエラーにする。旧区分の一括転送は対象・宛先・順序を制限し、個別記事の優先と別区分への誤適用をテストする。

新しい移行ノートにsource-urlがあるのに301がなければ警告する。新規作品であるだけなら旧URLは不要。旧記事を追加移行するときは、コンテンツをユーザーがObsidian DG Publishで送信し、取得済みの公開入力を確認してから301をシステム変更として追加する。本文をシステムcloneから同期・置換しない。

```text
node tools/check-redirects.cjs
node tools/check-redirects.cjs --live=https://hyodo-arch-dg.pages.dev
```

後者は実際のCloudflare応答を読み取り検証する。全633ルール（旧ページ送りはpage/2）、未対応11記事のスラッシュ有無、旧区分内の深いURL・旧ファイルURL、重複除外した全宛先、全sitemapページ、廃止／不明URL、似た名前の別区分、クエリ付きの代表URLを確認し、`.cache/redirects-check/` に結果を保存する。クエリの維持・削除は実応答を記録する。ブラウザJavaScriptやGA4は実行せず、フォーム・メール送信も行わない。

EleventyのdevサーバーではCloudflareのHTTP301を再現しない。HTTP応答はPages上で検証する。distや検証キャッシュはGitへ保存せず、上記ソースから再生成する。

## 本番ドメインの切替時

今回の公開はDGのpages.devに対する準備。旧wwwのDNS・旧サーバーは変更しない。本番wwwへの301は、wwwがこのPagesのデプロイを配信するようになってから適用される。

既存SITE_BASE_URLはユーザーが `https://www.hyodo-arch.com` に設定済み（2026-10-06）。この設定を維持し、robots.txt・canonical・sitemap/feed・OGPを本番設定で検証する。wwwのカスタムドメイン登録とメールの接続先を確認し、DNS・HTTPSが切り替わったら、次を実行する。

```text
node tools/check-redirects.cjs --live=https://www.hyodo-arch.com
```

2026-10-02の調査で、apexからwwwへの301は旧サーバーで設定済み、メールのMXはapex自体を参照していることを確認した。Value Domainのネームサーバー・apex A・MX・SPF等と既存のapex転送・SSLを維持し、wwwだけをPagesへ向ける。CloudflareのCustom domainsへwwwを登録してから、既存DNSに `cname www hyodo-arch-dg.pages.dev.` を追加する（2026-10-06の変更前本文でワイルドカードAの利用を確認）。切戻しは追加したwww CNAMEを削除する。DNS設定全体とメール・旧サーバーの維持方法はVaultの `_メモ置場/サイト運用の説明書/DNS・メール・切戻し手順.md` を参照する。

pages.devからwwwへの転送は本番確認後にCloudflare側で別途設定・検証する。_redirectsにはドメイン転送を混ぜず、pages.devの検証入口は本番確認後に切り替える。HTTP→HTTPSの挙動も切替時に確認する。

運用・上書きリスクはVaultの `_メモ置場/301設定の準備と検証記録.md` と `_メモ置場/サイト運用の説明書/アップデート時に上書きされる可能性のあるファイル.md` に記録する。
