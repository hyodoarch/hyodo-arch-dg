# 各PCでの開発と公開

GitHubがDGの共有元。Vaultの元ノート・画像はDropboxで同期し、DGの通常cloneは同期対象外の `Documents/GitHub/hyodo-arch-dg` に置く。

## 初回設定

1. GitHubから通常cloneする。既存フォルダを上書きしない。
2. package.json指定のNode.js 22.xを用意し、`node --version` を確認する。
3. リポジトリのルートで `npm ci` を実行する。
4. PowerShellで `$env:DG_VAULT_PATH = 'そのPCのVault絶対パス'` を設定する。`.obsidian` を含むVaultルートを指定する。

この環境変数はセッション内だけ有効。常用する場合はWindowsのユーザー環境変数 `DG_VAULT_PATH` を同じ値に設定し、ターミナルや開発ツールを再起動する。PC固有値はGitへ入れない。

`tools/sync-vault.cjs` は `.env` をロードしない。`.env` に書いただけでは設定されない。変数がない場合はリポジトリの親を探すが、新配置の `Documents/GitHub` はVaultではない。終了コード0でも同期できたとは限らない。

## 普段の作業

- 開始時：Git状態とoriginを確認。cleanでbehindのみならff-onlyで更新する。
- Vaultを使う前にDropbox同期完了を確認する。
- 元ノート編集後：`npm run sync:vault`。既存の公開対象ノートと参照画像を更新する。新規ノートは同期対象への追加が必要。
- 表示確認：`npm run dev:local`。表示されたlocalhostのURLを開く。起動時と監視中にVault同期が動く。終了はCtrl+C。
- 公開確認：`npm test`、`npm run build`。buildはdistを削除・再生成し、設定されたテーマを取得する。同期はbuild自体には含まれない。
- ソース差分を確認してcommitし、依頼された公開は `git push origin main`。Cloudflareの該当コミット成功と実サイトを確認する。

`src/site/notes/` と `src/site/img/user/` は公開用入力としてGit管理する。`dist/`、`node_modules/`、生成テーマCSS、`.cache/` は通常Gitへ入れない。`.cache/` に独自資料があるときは保存要否を調べてから整理する。

## 表示検証

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

リポジトリのルートで次を実行する。起動補助は現在のセッション、未設定ならユーザー環境変数を読み、Node 22とVaultの存在を確認する。システム全体のPATHは変更しない。

```powershell
powershell -ExecutionPolicy Bypass -File tools/local.ps1
powershell -ExecutionPolicy Bypass -File tools/local.ps1 -Task sync:vault
powershell -ExecutionPolicy Bypass -File tools/local.ps1 -Task test
powershell -ExecutionPolicy Bypass -File tools/local.ps1 -Task build
powershell -ExecutionPolicy Bypass -File tools/local.ps1 -Task install
```

既定のTaskはdev:local。終了はCtrl+C。初回install、公開前test/buildも同じNodeで実行できる。実行ポリシーの指定はこの起動プロセスだけに適用され、永続的なポリシー変更は行わない。
