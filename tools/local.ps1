param([ValidateSet('dev:local','sync:vault','build','test','install')][string]$Task = 'dev:local')
$ErrorActionPreference = 'Stop'
$previousPath = $env:PATH
$previousVault = $env:DG_VAULT_PATH
$nodeDirectory = $env:DG_NODE_PATH
if (!$nodeDirectory) { $nodeDirectory = [Environment]::GetEnvironmentVariable('DG_NODE_PATH', 'User') }
if (!$env:DG_VAULT_PATH) { $env:DG_VAULT_PATH = [Environment]::GetEnvironmentVariable('DG_VAULT_PATH', 'User') }
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    if ($nodeDirectory) { $env:PATH = $nodeDirectory + [IO.Path]::PathSeparator + $env:PATH }
    $version = & node.exe --version
    if ($LASTEXITCODE -ne 0 -or $version -notmatch '^v22\.') { throw 'Node.js 22.x is required. Set DG_NODE_PATH to its directory.' }
    if ($Task -in @('dev:local', 'sync:vault')) {
        if (!$env:DG_VAULT_PATH -or !(Test-Path -LiteralPath (Join-Path $env:DG_VAULT_PATH '.obsidian') -PathType Container)) {
            throw 'Set DG_VAULT_PATH to the Obsidian vault directory before syncing.'
        }
    }
    if ($Task -eq 'install') { & npm.cmd ci } else { & npm.cmd run $Task }
    if ($LASTEXITCODE -ne 0) { throw "npm failed with exit code $LASTEXITCODE" }
} finally {
    Pop-Location
    $env:PATH = $previousPath
    $env:DG_VAULT_PATH = $previousVault
}
