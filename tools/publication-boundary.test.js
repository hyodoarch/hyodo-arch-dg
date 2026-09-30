import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const project = path.resolve(import.meta.dirname, '..');
const scripts = JSON.parse(fs.readFileSync(path.join(project, 'package.json'), 'utf8')).scripts;

describe('Obsidian content and system publication boundary', () => {
  it('previews without running or watching Vault note sync', () => {
    for (const task of ['dev', 'dev:local']) {
      expect(scripts[task]).not.toMatch(/sync:vault|watch:vault|watch:\*/);
      expect(scripts[task]).toContain('watch:eleventy');
    }
    expect(scripts['watch:vault']).toBeUndefined();
  });
  it('refuses the retired sync before touching public notes', () => {
    const note = path.join(project, 'src/site/notes/HOME.md');
    const before = fs.readFileSync(note);
    const result = spawnSync(process.execPath, ['tools/sync-vault.cjs'], { cwd: project, encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Publish content with Obsidian Digital Garden');
    expect(fs.readFileSync(note)).toEqual(before);
  });
  // Execute the real scope classifier with fake status output, without invoking
  // fetch, commit or push. This also checks Windows PowerShell 5.1 compatibility.
  const windowsIt = process.platform === 'win32' ? it : it.skip;
  for (const [file, accepted] of [
    ['src/site/notes/work.md', false],
    ['src/site/img/user/images/work/photo.jpg', false],
    ['src/site/notes/notes.json', true],
    ['src/site/styles/user/custom.scss', true],
    ['src/site/img/banner.jpg', true],
  ]) {
    windowsIt(`${accepted ? 'accepts system' : 'blocks content'} change ${file}`, () => {
      const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dg-boundary-'));
      try {
        const target = path.join(temp, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, 'fixture');
        const source = fs.readFileSync(path.join(project, 'tools/publish-dg.ps1'), 'utf8');
        const classifier = source.slice(source.indexOf('function Get-SourceChanges'), source.indexOf('\ntry {'));
        const harness = "$ErrorActionPreference = 'Stop'\nImport-Module Microsoft.PowerShell.Utility\nfunction Invoke-GitChecked { param([string[]]$GitArgs) ' M " + file + "' }\n" + classifier + "\ntry { @(Get-SourceChanges) | Out-Null; exit 0 } catch { Write-Error $_; exit 1 }\n";
        fs.writeFileSync(path.join(temp, 'check.ps1'), '\ufeff' + harness);
        const env = { ...process.env };
        // PowerShell 7's module path must not hide Windows PowerShell modules.
        for (const key of Object.keys(env)) if (key.toUpperCase() === 'PSMODULEPATH') delete env[key];
        env.PSModulePath = path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/Modules');
        const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(temp, 'check.ps1')], { cwd: temp, env });
        expect(result.status, result.stderr?.toString()).toBe(accepted ? 0 : 1);
      } finally {
        if (path.dirname(path.resolve(temp)) !== path.resolve(os.tmpdir()) || !path.basename(temp).startsWith('dg-boundary-')) throw new Error('Unexpected fixture path');
        fs.rmSync(temp, { recursive: true, force: true });
      }
    });
  }
});
