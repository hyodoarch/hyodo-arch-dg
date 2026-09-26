# 過去のローカル表示検証スクリプト

2026-09-26、検証用worktree `.hyodo-arch-dg-release` の廃止に伴い、
`.cache/compare-dozo.cjs` と `.cache/verify-publish.cjs` をこの場所へ移動した。
移動前後のSHA-256一致を確認済み。スクリプトの内容は変更していない。

通常の開発・表示確認は、このリポジトリのルートで `npm run dev:local` を実行する。
依存関係の復元は `npm ci`、公開用ビルドは `npm run build`、テストは `npm test`。
package.jsonの指定Node.jsは22.x。

## 保存したスクリプトの使い方と制約

リポジトリのルートから実行する。これらは当時の検証用で、通常ビルドには不要。
ローカルのCodexランタイム配下のPlaywrightを絶対パスで参照し、Microsoft Edgeを使う。
別PCでは依存先の調整が必要。出力先の `.cache/` が必要。

- `node tools/local-verification/verify-publish.cjs`：既存の `dist/` を一時HTTPサーバーで配信し、HOME・マンション一覧・山下・和風タグを1440px／390pxで確認する。`VERIFY_BASE` 指定時はそのURLを検査する。スクリーンショットは `.cache/` に出力。
- `node tools/local-verification/compare-dozo.cjs`：`http://127.0.0.1:8765/projects/ushibori_dozo/` と公開サイト（または `COMPARE_BASE`）を比較し、JSONと画像を `.cache/` に出力する。8765側のサーバーは別途必要であり、通常の `dev:local` の8080とは異なる。

今回の移動では構文確認のみ実施。過去の検証結果が現在の公開サイトとの一致を保証するものではない。
通常プレビューと公開確認は区別し、公開するソースをコミット・検証して通常pushする。
