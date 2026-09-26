# 2026年9月のローカル取込・表示検証スクリプト

2026-09-26、Vault配下の作業環境から独立cloneへ移行する際に、`.cache/` に残っていた16本を履歴資料として保存した。コピー前後のSHA-256一致を確認し、本文は変更せず、誤実行を避けるため `.cjs.txt` にしている。元の `.cache/` は削除していない。

これらは現在の動作を保証するテスト群ではない。現在の検証には `../../local-verification/check-site.cjs` を使用する。

| 元ファイル | 用途・制約 |
| --- | --- |
| convert-projects.cjs | 旧WEBのHTMLから10作品を変換。TEMP内の元HTMLに依存し、Vaultと取込JSONへ書き込む |
| sync-import.cjs | project-import.jsonに従ってノート・画像と移行メモを書き込む。旧親階層に依存 |
| update-sekiguchi.cjs | 関口酒造のノート2配置を直接書き換える一回限りの処理 |
| verify-import.cjs | TEMPの元HTML・取込JSONとVaultを比較 |
| browser-check.cjs | 取込JSON、旧project-preview、distを使う表示検証 |
| check-categories.cjs | localhost:8081の旧カテゴリー名・掲載件数を前提に検証 |
| check-scrollbar.cjs | localhost:8080でスクロールバーを計測 |
| verify-live.cjs | 特定時点の公開画像グリッドを検証。旧見出し・画像数を前提 |
| verify-main.cjs | 旧本文・メニュー位置を検証。DOMの表示状態を一時変更する |
| verify-navigation.cjs | 旧メニューの右端配置を検証。DOMの表示状態を一時変更する |
| verify-note-template.cjs | Eleventyの一時テンプレートでタイトル・タグを検証 |
| verify-sekiguchi.cjs | 関口酒造の特定構成を検証 |
| verify-sidebar-style.cjs | 旧sidebar幅・色を検証 |
| verify-sidebar.cjs | 旧sidebar配置を検証。現在の本文下フッター配置とは異なる |
| verify-tag-style.cjs | 別の公開QuartzサイトとDGのタグを比較計測 |
| verify-vault-sync.cjs | Vaultへ一時マーカーを追記・除去する同期検証。現在の通常検証には使わない |

Playwrightの自宅PC絶対パスまたは廃止済み `.obsidian-image-grid-captions-dev` への参照、旧localhostポート、旧相対パス、当時の掲載件数等が残る。再利用する場合は用途に応じて新しい実行用ファイルへ必要部分を取り出し、依存先と期待値を見直す。拡張子を戻して一括実行しない。

参照する取込JSON・元HTML・バックアップ・検証画像はこのフォルダに含めない。旧環境の `.cache/` に保留し、唯一の必要資料がないか確認してから別途保管を判断する。ここにスクリプトを保存しただけで旧キャッシュ全体を削除可能と判断しない。
