import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const project = path.resolve(import.meta.dirname, '..');
const source = fs.readFileSync(path.join(project, 'tools/publish-dg.ps1'), 'utf8');
// Exercise the real functions, without the production fetch/commit/push entrypoint.
const functions = source.slice(source.indexOf('function Invoke-GitChecked'), source.indexOf('\ntry {'));
const note = 'src/site/notes/ご依頼・ご相談/index.md';
const image = 'src/site/img/user/images/写真.jpg';
const style = 'src/site/styles/user/hyodo-contact.scss';
const otherStyle = 'src/site/styles/user/hyodo-arch.scss';
const windowsIt = process.platform === 'win32' ? it : it.skip;

function fixture(run) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dg-publish-sync-'));
  const repo = path.join(temp, 'repo');
  fs.mkdirSync(repo);
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1' };
  // Isolate fixtures from user Git settings and PowerShell 7 module paths.
  for (const key of Object.keys(env)) {
    if (/^(GIT_|PSMODULEPATH$)/i.test(key)) delete env[key];
  }
  const gitConfig = path.join(temp, 'empty-gitconfig');
  fs.writeFileSync(gitConfig, '');
  Object.assign(env, {
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: gitConfig,
    PSModulePath: path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/Modules'),
  });
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: repo, env, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr || result.error?.message);
    return result.stdout.trim();
  };
  const write = (file, content) => {
    const target = path.join(repo, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  };
  const read = (file) => fs.readFileSync(path.join(repo, file), 'utf8');
  const commit = () => {
    git('add', '--all');
    git('commit', '-m', 'fixture');
    return git('rev-parse', 'HEAD');
  };
  const upstream = (change) => {
    git('switch', '-c', 'fixture-upstream');
    change();
    const target = commit();
    git('update-ref', 'refs/remotes/origin/main', target);
    git('switch', 'main');
    return target;
  };
  const execute = () => {
    const harness = path.join(temp, 'run.ps1');
    fs.writeFileSync(harness, '\ufeff' + "$ErrorActionPreference = 'Stop'\n[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)\n" + functions +
      "\ntry { Sync-PublishRepository; exit 0 } catch { Write-Host $_.Exception.Message; exit 1 }\n");
    return spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', harness], { cwd: repo, env, encoding: 'utf8', timeout: 15000 });
  };
  const localSnapshot = () => ({
    head: git('rev-parse', 'HEAD'),
    status: git('status', '--porcelain=v1'),
    work: git('diff', '--binary'),
    index: git('diff', '--cached', '--binary'),
    stashes: git('stash', 'list'),
  });
  try {
    git('init', '-b', 'main');
    git('config', 'user.name', 'Publication fixture');
    git('config', 'user.email', 'fixture@example.invalid');
    git('config', 'core.autocrlf', 'false');
    git('config', 'core.quotepath', 'false');
    git('config', 'core.hooksPath', path.join(temp, 'no-hooks'));
    write(note, 'old note\n');
    write(image, 'old image');
    write(style, '.card { color: black; }\n');
    write(otherStyle, 'body { color: black; }\n');
    write('.gitignore', 'src/site/img/user/ignored.jpg\n');
    const base = commit();
    git('update-ref', 'refs/remotes/origin/main', base);
    run({ git, write, read, commit, upstream, execute, localSnapshot, base });
  } finally {
    // Delete only the exact temporary fixture root, never a project checkout.
    if (path.dirname(path.resolve(temp)) !== path.resolve(os.tmpdir()) || !path.basename(temp).startsWith('dg-publish-sync-')) throw new Error('Unexpected fixture path');
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

function succeeds(result) {
  expect(result.status, result.stdout + result.stderr).toBe(0);
}
function blockedUnchanged(f, expectedMessage) {
  const before = f.localSnapshot();
  const result = f.execute();
  expect(result.status, result.stdout + result.stderr).toBe(1);
  if (expectedMessage) expect(result.stdout).toContain(expectedMessage);
  expect(f.localSnapshot()).toEqual(before);
}

describe('publication fast-forward with local system edits (Windows PowerShell 5.1)', () => {
  windowsIt('imports Japanese notes and images, preserving SCSS and untracked system files', () => fixture(f => {
    const target = f.upstream(() => {
      f.write(note, 'new note\n');
      f.git('mv', image, 'src/site/img/user/images/新しい写真.jpg');
    });
    f.write(style, '.card { display: grid; }\n');
    f.write('src/site/styles/user/new.scss', '.new {}\n');
    // Explicitly prove that even a user-enabled autostash is not used.
    f.git('config', 'merge.autostash', 'true');
    const before = f.localSnapshot();
    succeeds(f.execute());
    expect(f.git('rev-parse', 'HEAD')).toBe(target);
    expect(f.read(note)).toBe('new note\n');
    expect(f.read('src/site/img/user/images/新しい写真.jpg')).toBe('old image');
    expect(f.read(style)).toBe('.card { display: grid; }\n');
    expect(f.read('src/site/styles/user/new.scss')).toBe('.new {}\n');
    expect(f.localSnapshot()).toEqual({ ...before, head: target });
  }), 20000);

  windowsIt('keeps normal clean fast-forwards, including system updates', () => fixture(f => {
    const target = f.upstream(() => f.write(otherStyle, 'body { color: blue; }\n'));
    succeeds(f.execute());
    expect(f.git('rev-parse', 'HEAD')).toBe(target);
    expect(f.git('status', '--porcelain')).toBe('');
  }), 20000);

  windowsIt('leaves local SCSS alone when already up to date', () => fixture(f => {
    f.write(style, '.card { display: grid; }\n');
    const before = f.localSnapshot();
    succeeds(f.execute());
    expect(f.localSnapshot()).toEqual(before);
  }), 20000);

  for (const remoteFile of [style, otherStyle, 'src/site/notes/notes.json']) {
    windowsIt(`blocks remote system update ${remoteFile} with local edits`, () => fixture(f => {
      f.upstream(() => f.write(remoteFile, 'remote system change\n'));
      f.write(style, '.card { display: grid; }\n');
      f.git('config', 'merge.autostash', 'true');
      blockedUnchanged(f, 'GitHub側にシステムの更新');
    }), 20000);
  }

  for (const localFile of [note, image]) {
    windowsIt(`protects local content ${localFile}`, () => fixture(f => {
      f.upstream(() => f.write(note, 'new note\n'));
      f.write(localFile, 'local content edit');
      blockedUnchanged(f, 'コンテンツのローカル変更');
      expect(f.read(localFile)).toBe('local content edit');
    }), 20000);
  }

  for (const diverged of [false, true]) {
    windowsIt(`blocks ${diverged ? 'diverged history' : 'unpushed commits'}`, () => fixture(f => {
      if (diverged) f.upstream(() => f.write(note, 'new note\n'));
      f.write(style, '.card { color: red; }\n');
      f.commit();
      f.write(style, '.card { display: grid; }\n');
      blockedUnchanged(f, '未pushのコミット');
    }), 20000);
  }

  windowsIt('checks both sides of a rename from a system path into content', () => fixture(f => {
    f.upstream(() => f.git('mv', otherStyle, 'src/site/notes/moved.md'));
    f.write(style, '.card { display: grid; }\n');
    blockedUnchanged(f, 'GitHub側にシステムの更新');
  }), 20000);

  windowsIt('does not overwrite ignored local images added upstream', () => fixture(f => {
    const ignored = 'src/site/img/user/ignored.jpg';
    f.upstream(() => {
      f.write(ignored, 'remote image');
      f.git('add', '-f', '--', ignored);
    });
    f.write(ignored, 'local image');
    f.write(style, '.card { display: grid; }\n');
    blockedUnchanged(f);
    expect(f.read(ignored)).toBe('local image');
  }), 20000);
});
