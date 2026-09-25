# 本文へのタイトル・タグの差し込み

DGのノート本文ではNunjucksをMarkdownより先に処理します。
本文は自動で書き換えません。表示したい位置に次を記述してください。

```markdown
# {{ title }}

{% noteTags %}

本文をここに書きます。
```

- `{{ title }}`：トップレベルのtitle、公開されたdg-note-propertiesのtitle、ノートのファイル名（拡張子なし）の順に取得します。
- `{% noteTags %}`：タグへのリンク一覧を出力します。独立した行に置き、前後に空行を設けてください。タグなしなら何も表示しません。DG内部用のnoteとgardenEntryは表示しません。
- タイトルだけが必要ならタグの行は不要です。
- header内のタイトル・タグの自動表示は停止しています。既存本文の手書きタイトルを差し込み記法に置き換えてください。
- Obsidian標準の閲覧表示では、記法はそのまま表示されます。

## 編集場所

編集するのはObsidian側の元ノートです。関口酒造はVault内の `古民家リノベーション/関口酒造母屋リノベーション.md` です。

ローカル開発サーバーを `npm run dev:local` または `npm run dev` で起動すると、元ノートを約1秒間隔で確認します。
元ノートを保存 → DG側のMarkdownへ同期 → Eleventyが再ビルド、という順に反映されます。
`dev:local` は既に取得済みのテーマを使い、テーマの再ダウンロードを省略します。

対象は、DGの `src/site/notes/` に既に存在し、Vault内の同じ相対パスにも存在する `dg-publish: true` のノートです。
新しいノートを追加する場合は、DG側へ初回登録してから自動同期の対象になります。
DG側のMarkdownを直接編集する必要はありません。元ノートが正となるため、DG側のみの編集は次回同期で上書きされます。
初回の上書き前のDGファイルは `.cache/vault-sync-backup/` に保存します。

同期はローカルのみです。GitHubや公開サイトへ自動送信はしません。
Vaultがこのリポジトリの親フォルダー以外にある場合は、環境変数 `DG_VAULT_PATH` にVaultのパスを設定してください。

## 記法自体を説明文・コード例として掲載する場合

NunjucksはMarkdownのコードブロック内も先に処理します。
置換させたくない範囲を `{% raw %}` と `{% endraw %}` で囲んでください。

````text
{% raw %}
```markdown
# {{ title }}
{% noteTags %}
```
{% endraw %}
````

## 実装

- `src/site/notes/notes.json`：ノートの処理順を `njk,md` に設定。
- `src/site/notes/notes.11tydata.js`：タイトルの取得とheaderの表示設定。
- `src/helpers/noteTemplate.js`：タイトル・タグの取得とHTML生成。
- `src/helpers/userSetup.js`：noteTagsショートコードの登録。

設定変更が起動中のプレビューに反映されない場合は、開発サーバーを停止して `npm run dev` で再起動してください。

