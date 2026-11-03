# Google AdSense用ads.txt

追加日：2026-11-03。対象：`hyodoarch/hyodo-arch-dg` / Cloudflare Pages `hyodo-arch-dg`。

## 目的と内容

兵藤善紀建築設計事務所サイトのルート `/ads.txt` に、指定されたGoogle AdSenseの販売者情報を配置する。広告表示コードの追加ではない。別サイト `blog.hyodo-arch.com`（Quartz）は対象外。

元ファイル `src/site/ads.txt` は次の1行のみ。UTF-8・BOMなし、末尾改行はLFまたはCRLFで1つまで。

```text
google.com, pub-0569052513940110, DIRECT, f08c47fec0942fa0
```

## 追加・変更ファイル

パスはすべてDGリポジトリルート相対。

| ファイル | 内容・区分 |
| --- | --- |
| `src/site/ads.txt` | 独自追加の公開用テキスト。Git管理するシステム資産 |
| `.eleventy.js` | 標準設定の既存コピー群の末尾に1行追加 |
| `package.json` | 既存設定に `postbuild` と `check:ads-txt` を追加 |
| `tools/check-ads-txt.cjs` | Node標準機能のみで元ファイルの正確な内容と生成物のバイト一致を確認 |
| `tools/check-ads-txt.test.js` | 既存Vitestで元ファイル・実設定のコピー登録・npm登録と、欠落／誤内容の検出を確認 |
| `tools/publish-dg.ps1` | 公開対象として `src/site/ads.txt` だけを個別許可。他のtxtへ対象を広げない |
| `tools/publication-boundary.test.js` | Windows PowerShellでads.txtの許可と、他のtxt・類似名・作品データの拒否を確認 |
| `docs/customizations/README.md`、本ファイル | 独自資料。更新時の一覧と確認・復元手順 |
| `AGENTS.md` | 更新前にカスタマイズ記録を読み、更新後の検証を行う指示。Vault台帳の移動後パスも修正 |

`dist/ads.txt` は生成物。直接編集・Git登録しない。`.env`・認証情報・Cloudflare Pages設定・公開入力ノートは変更しない。新しい依存パッケージは追加しない。

## Eleventyの変更と理由

`.eleventy.js` 内の `module.exports = function(eleventyConfig)` にある既存の `addPassthroughCopy` 群へ追加する。

```js
eleventyConfig.addPassthroughCopy("src/site/ads.txt");
```

現在の `templateFormats` は `njk`, `md`, `11ty.js`, `canvas` で、既存のコピー対象にもads.txtが含まれていない。入力にtxtを置くだけでは配信されないため、[EleventyのPassthrough File Copy](https://www.11ty.dev/docs/copy/)を使う。入力 `src/site` からの相対パスを保ち、出力 `dist/ads.txt` へ内容を変換せずコピーする。既存の画像・scripts・theme・logoやSearch Console確認ファイルの設定を維持する。

## 自動検証

`package.json` の追加項目：

```json
"postbuild": "node tools/check-ads-txt.cjs",
"check:ads-txt": "node tools/check-ads-txt.cjs"
```

`npm run build` は既存prebuildでdistを消してから通常ビルドし、成功後にpostbuildで検査する。欠落・誤ったID・BOM・余分な行・出力不一致は終了コード1となり、Cloudflareのビルドコマンドを変更せず検出できる。古いdistを確認するだけでは不十分なので、更新後は必ずbuildを先に実行する。

`npm test` は既存distに依存せず、元ファイルと実際の `.eleventy.js` でのコピー登録、入出力ディレクトリ、postbuildの登録を検査する。隔離した一時fixtureで欠落・誤内容の失敗も確認する。外部通信・新しい依存は不要。`npm run build:eleventy` 単独ではnpmのpostbuildを実行しないため、公開検証には通常の `npm run build` を使う。

## 更新で失われる可能性と復元

- `.eleventy.js` と `package.json` は標準ファイル／既存設定への直接変更。本体更新・マージ・再インストール時の置換でコピー登録や検証の呼出が消える可能性がある。コピーが消えるとads.txtが配信されず、postbuildが消えるとビルド時の欠落検知も失われる。
- ads.txt・検査・docs・AGENTS.mdは独自追加または独自資料。通常残るが保証ではなく、cloneの作り直し・フォルダー置換・未コミット状態の消失で失われうる。すべてを一緒にGit保存する。
- `tools/publish-dg.ps1` の `$systemAsset = $path -ceq 'src/site/ads.txt'` と、その許可判定も維持する。公開補助の置換で失われると `DG-Publish.cmd` がads.txtを対象外として停止する。拡張子txt全般の許可へ広げず、個別許可と `tools/publication-boundary.test.js` を組で復元する。
- 復元元は `hyodoarch/hyodo-arch-dg` の、この記録と実装を保存したGit履歴。`git log -- src/site/ads.txt docs/customizations/ads-txt.md` で導入・変更コミットを確認し、`git show <コミット>:<パス>` で内容を照合する。未コミットの新しい変更がある場合は、その部分をGitHubから復元できるとは扱わない。
- 元ファイルを上記の正確な1行で復元し、コピー設定1行を既存設定へ再統合する。検査スクリプト・テスト・npm scripts・資料・AGENTS.mdの参照も対応する履歴と照合する。上流の新機能や他のカスタマイズを失うため、古い `.eleventy.js` や `package.json` を丸ごと上書きしない。
- 本ファイルはVaultノートではなくシステム資産。DG Publishのノート送信やVault同期で置き換えず、通常cloneからシステム変更として扱う。

## アップデート後の確認

リポジトリルートでNode22を選び、依存を復元する必要がある場合だけ `npm ci`。その後、順番に実行する。

```sh
npm test
npm run build
npm run check:ads-txt
```

成功条件：元ファイルが存在し正確な1行、コピー登録が有効、buildの終了コードが0、postbuildの成功メッセージ `[ads.txt] Source record and dist/ads.txt verified.` が出ること。手動確認では `dist/ads.txt` が同じ1行で、HTMLや404本文になっていないことも確かめる。

Windowsの既存起動補助は `tools/local.ps1 -Task test` と `tools/local.ps1 -Task build`。Node22の選び方は [開発手順](../local-development.md) を参照する。

## GitHub反映・公開後の確認

ユーザーの変更確認後にcommit・pushする。2026-11-03に今回分のGitHub反映・公開確認の許可を得ている。通常運用ではVaultの `DG-Publish.cmd` から確認・テスト・build・commit・pushを実行できる。公開前の対象だけを調べる場合は、通常cloneで `powershell -NoProfile -ExecutionPolicy Bypass -File tools/publish-dg.ps1 -Check` を使う。

1. 必要な追加ファイルがGitHubに入り、HEADとorigin/mainのコミット・ツリーが一致し、追跡差分や必要な未追跡ソースが残っていないことを確認する。
2. Cloudflare Pages `hyodo-arch-dg` の**そのコミット**の本番デプロイが成功していることを確認する。設定は `npm run build` / `dist` を維持する。
3. [wwwなし](https://hyodo-arch.com/ads.txt) と [wwwあり](https://www.hyodo-arch.com/ads.txt) の両方へGETし、最終HTTP 200、本文が上記1行、Content-Typeがテキストであることを確認する。転送がある場合は転送先・経路も記録し、最終応答を確認する。HTMLのエラーページや旧キャッシュの成功応答を混同しない。
4. AdSenseのサイト画面からads.txtのステータスを確認する。Google側の検出とCloudflareの公開成功は別。[Google公式手順](https://support.google.com/adsense/answer/12171612?hl=ja)の「アップデートを確認」も利用できる。

公開URLの検証はcommit・push・デプロイ後に行う。AdSense管理画面での認識状態は、公開URLの到達確認とは別に確認する。

## 2026-11-03の実装時検証

- 開始時は未コミット変更なし、fetch後にmainが14コミットbehindだったため `git pull --ff-only` で `3857517` まで更新してから実装した。この取込分は今回の編集に含めない。
- Node v22.23.3で `npm test` 成功：30ファイル・634テスト（今回追加14件）。欠落・誤ID・BOM・余分な行・出力不一致も隔離fixtureで検出できた。
- `npm run build` 成功（終了コード0）。最初の実行は環境の通信制限で既存テーマ取得に失敗したが、通信許可付きの同じ通常buildで成功。コピー734件・生成92件、postbuildのads.txt検査も成功。
- `npm run check:ads-txt` 成功。`dist/ads.txt` は指定された1行で、元ファイルとのバイト一致とSHA-256一致を確認した。distとbuildログはGit無視対象。
- 初回ローカル検証では未コミット・未pushで停止し、その後ユーザーの承認を得た。公開補助のads.txt個別許可と回帰テスト7件を追加した最終版は、Node22で全641テスト・通常build・postbuildが成功。公開スクリプトの `-Check` も今回の10ファイルを正常に受け付けた。その他のtxt、類似名、作品データを引き続き拒否することを確認した。
