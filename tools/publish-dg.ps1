param([string]$Repository = (Join-Path $env:USERPROFILE 'Documents/GitHub/hyodo-arch-dg'), [switch]$Check)
$ErrorActionPreference = 'Stop'
$previousPath = $env:PATH
$previousOutputEncoding = [Console]::OutputEncoding
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$locationChanged = $false

function Invoke-GitChecked {
    param([string[]]$GitArgs)
    & git @GitArgs
    if ($LASTEXITCODE -ne 0) { throw "Git failed: git $($GitArgs -join ' ')" }
}

function Get-SourceChanges {
    # NUL separators preserve spaces and Japanese filenames without Git quoting.
    $raw = (Invoke-GitChecked -GitArgs @('-c', 'core.quotepath=false', 'status', '--porcelain=v1', '-z', '--untracked-files=all')) -join "`n"
    $entries = @($raw.Split([char]0) | Where-Object { $_.Length -gt 0 })
    foreach ($entry in $entries) {
        $status = $entry.Substring(0, 2)
        $path = $entry.Substring(3)
        if ($path -match '^src/site/(notes/.*\.md$|img/user/)') {
            throw "コンテンツのローカル変更があります。Obsidian DG Publishの対象をこのコマンドで送信しません: $path"
        }
        $source = $path -match '^(src|tools|tests|docs)/.+\.(js|cjs|mjs|ts|json|njk|html|scss|css|md|ya?ml|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|ps1|cmd|sh)$'
        $rootConfig = $path -in @('package.json', 'package-lock.json', '.eleventy.js', '.env', '.env.example', 'netlify.toml', 'vercel.json', 'README.md', 'AGENTS.md')
        $excluded = $path -match '(^|/)(\.[^/]+|node_modules|dist|_site|cache|secrets?)(/|$)' -or
            $path -match '(^|/)(credentials?|secrets?|private[-_]key)([._-]|$)' -or
            $path -match '^src/site/styles/_?theme\..*\.css$'
        if ($status -notin @(' M', 'M ', 'MM', 'A ', 'AM', '??', ' D', 'D ') -or
            !($source -or $rootConfig) -or ($excluded -and !$rootConfig) -or $path -match '[\r\n]') {
            throw "対象外の変更、移動、競合などがあります。公開を中止します: $entry"
        }
        $hash = if (Test-Path -LiteralPath $path -PathType Leaf) { (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash } else { 'DELETED' }
        [pscustomobject]@{ Status = $status; Path = $path; Hash = $hash }
    }
}

try {
    Push-Location -LiteralPath $Repository
    $locationChanged = $true
    if ((Invoke-GitChecked -GitArgs @('branch', '--show-current')) -ne 'main') {
        throw 'mainブランチ以外では公開しません。'
    }
    $origin = Invoke-GitChecked -GitArgs @('remote', 'get-url', 'origin')
    if ($origin -notmatch '^(https://github\.com/|git@github\.com:)hyodoarch/hyodo-arch-dg(?:\.git)?$') {
        throw '想定したGitHubリポジトリではありません。originを確認してください。'
    }
    if ($Check) {
        @(Get-SourceChanges) | Format-Table Status, Path -AutoSize
        Write-Host '対象確認のみ。fetch・テスト・ビルド・コミット・pushは実行していません。'
        exit 0
    }
    Write-Host '1/5 GitHubと作業中の変更を確認しています。'
    Invoke-GitChecked -GitArgs @('status', '-sb')
    Invoke-GitChecked -GitArgs @('fetch', '--prune', 'origin')
    $changes = @(Get-SourceChanges)
    $counts = (Invoke-GitChecked -GitArgs @('rev-list', '--left-right', '--count', 'HEAD...origin/main')) -split '\s+'
    if ([int]$counts[0] -gt 0) {
        throw '未pushのコミットがあります。内容確認が必要なため停止しました。Codexに「DG公開の続きをお願いします」と伝えてください。'
    }
    if ([int]$counts[1] -gt 0) {
        if ($changes.Count -gt 0) {
            throw 'GitHub側に新しい更新があります。ローカルのシステム変更を保護して停止しました。更新との競合を確認してからシステム修正を反映してください。'
        }
        Invoke-GitChecked -GitArgs @('pull', '--ff-only', 'origin', 'main')
    }
    if ($changes.Count -eq 0) {
        Write-Host '公開する変更はありません。'
        exit 0
    }

    Write-Host '以下のシステム変更を公開します（Dは削除）。作品ノート・本文画像はObsidian DG Publishで公開します。'
    $changes | Format-Table Status, Path -AutoSize | Out-Host
    $answer = Read-Host 'この一覧をテスト・ビルド・コミットしてGitHubへ送信しますか？ [y/N]'
    if ($answer -notmatch '^(?i:y|yes)$') { Write-Host 'キャンセルしました。'; exit 0 }
    $approvedSnapshot = ConvertTo-Json -InputObject $changes -Compress
    $approvedHead = Invoke-GitChecked -GitArgs @('rev-parse', 'HEAD')

    # Use Node 22 without modifying the machine-wide PATH.
    $npmCommand = (Get-Command npm.cmd -ErrorAction Stop).Source
    $npmCli = Join-Path (Split-Path $npmCommand) 'node_modules/npm/bin/npm-cli.js'
    if (!(Test-Path -LiteralPath $npmCli)) { throw 'npmの実行ファイルが見つかりません。Codexに環境確認を依頼してください。' }
    $nodeCandidates = @(
        $env:DG_NODE_PATH,
        [Environment]::GetEnvironmentVariable('DG_NODE_PATH', 'User'),
        (Join-Path $Repository '.cache/node22/node_modules/node/bin'),
        (Split-Path (Get-Command node.exe -ErrorAction Stop).Source)
    )
    $nodeExe = $null
    foreach ($directory in $nodeCandidates) {
        if (!$directory) { continue }
        $candidate = Join-Path $directory 'node.exe'
        if (!(Test-Path -LiteralPath $candidate)) { continue }
        $version = & $candidate --version
        if ($LASTEXITCODE -eq 0 -and $version -match '^v22\.') { $nodeExe = $candidate; break }
    }
    if (!$nodeExe) { throw 'Node.js 22が必要です。DG_NODE_PATHを設定してください。' }
    $env:PATH = (Split-Path $nodeExe) + [IO.Path]::PathSeparator + $env:PATH

    Write-Host '2/5 テストを実行しています。'
    & $nodeExe $npmCli test
    if ($LASTEXITCODE -ne 0) { throw 'テストが失敗したため公開していません。変更は保存されています。' }
    Write-Host '3/5 公開用ビルドを実行しています。'
    & $nodeExe $npmCli run build
    if ($LASTEXITCODE -ne 0) { throw 'ビルドが失敗したため公開していません。変更は保存されています。' }
    # Recheck the file scope after generation, before staging anything.
    $changes = @(Get-SourceChanges)
    if ((ConvertTo-Json -InputObject $changes -Compress) -cne $approvedSnapshot -or
        (Invoke-GitChecked -GitArgs @('rev-parse', 'HEAD')) -ne $approvedHead) {
        throw '確認後にソースやGit状態が変わりました。未確認の変更を含めないため停止します。再実行してください。'
    }
    $paths = @($changes | ForEach-Object { $_.Path })
    Invoke-GitChecked -GitArgs (@('diff', '--check', '--') + $paths)
    Invoke-GitChecked -GitArgs (@('diff', '--cached', '--check', '--') + $paths)
    Write-Host '4/5 確認済みの変更をコミットしています。'
    Invoke-GitChecked -GitArgs (@('add', '--all', '--') + $paths)
    Invoke-GitChecked -GitArgs @('commit', '-m', 'Update Digital Garden sources')

    Write-Host '5/5 GitHubへ送信しています。'
    Invoke-GitChecked -GitArgs @('push', 'origin', 'main')
    Invoke-GitChecked -GitArgs @('status', '-sb')
    Write-Host 'GitHubへの送信が完了しました。Cloudflareの公開処理は別途進みます。'
    Write-Host 'デプロイ成功後にWebを再読み込みしてください（このスクリプトでは公開完了までは確認しません）。'
} catch {
    Write-Host "停止: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host '変更の破棄・強制pushはしていません。この画面をCodexに送ってください。'
    exit 1
} finally {
    $env:PATH = $previousPath
    [Console]::OutputEncoding = $previousOutputEncoding
    if ($locationChanged) { Pop-Location }
}
