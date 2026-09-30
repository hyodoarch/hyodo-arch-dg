# hyodo-arch-dg の作業規則

このリポジトリは兵藤善紀建築設計事務所のDigital Gardenサイト。親フォルダに別プロジェクト（Quartz等）の説明があっても、このDGの実装・package.jsonを基準にする。

- GitHub `hyodoarch/hyodo-arch-dg` を共有元とし、各PCの同期対象外の `Documents/GitHub/hyodo-arch-dg` を通常作業場所にする。Vaultは別途Dropboxで同期する。
- 編集前に `git status -sb` と `git fetch --prune`。cleanでbehindのみなら `git pull --ff-only`。未コミット変更・ahead・divergedは先に報告し、既存変更を保護する。reset・stash・rebase・merge・force-pushを自動で行わない。
- commit・pushは依頼された範囲で行う。追加対象を明示し、生成物やPC固有情報を一括追加しない。
- `docs/local-development.md` を参照。Nodeはpackage.json指定（現在22.x）、依存復元は `npm ci`、検証は `npm test` と `npm run build`。
- コンテンツ（Vault）とシステム（本repo）は独立。作品追加はVaultだけで行い、コンテンツの公開はユーザーのObsidian Digital Garden Publishが必須。通常dev/buildでVaultノートを同期しない。Publish後の公開入力はGitHubから取得し、システム修正で上書きしない。
- 元ノート・元画像はVaultが正本。`npm run dev:local` は取得済みGitHub入力のプレビューのみ。`sync:vault` は廃止してエラー終了する。テンプレート共通画像に限りDG_VAULT_PATHを設定してsync:commonを使う。
- 公開入力の notes / images もGit管理する。同期物という理由で削除・追跡解除しない。これらはプラグイン送信済み入力として保持。システム公開コマンドは作品Markdown・img/userを送信対象にせず、ローカル変更があれば保護して停止する。プラグイン設定は勝手に変更しない。
- mainへの通常pushはCloudflareの公開更新につながる。完了時はHEADとorigin/mainのコミット・ツリー一致、追跡差分なし、必要な未追跡ソースなし、該当コミットのデプロイ成功を確認する。
- 見た目だけで同一と判断しない。公開に影響する保留差分を含むbuildを、コミット済みソースの検証結果として扱わない。
- 別clone・worktreeは必要性を説明して了承を得た場合のみ作成。旧Vault配下の作業環境は移行保管用で、両PC確認前に削除しない。
- 標準ファイルの変更や独自拡張について、更新時の上書き・再生成リスクと復元元を記録する。Vaultが利用可能なら `_メモ置場/アップデート時に上書きされる可能性のあるファイル.md` を更新する。
- 作業終了時に変更ファイル、検証結果、`git status -sb`、ahead/behind、未完了事項を報告する。

- ユーザーが明言しない限り一時しのぎを行わない。原因に対する修正と再発条件の検証を行い、未解決事項を完了として扱わない。
