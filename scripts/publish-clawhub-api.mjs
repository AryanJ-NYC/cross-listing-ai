import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const TEXT_EXTENSIONS = new Set([
  '.md',
  '.txt',
  '.json',
  '.yaml',
  '.yml',
  '.sh',
  '.js',
  '.mjs',
  '.cjs',
]);
const SKIP_DIRECTORIES = new Set(['.git', '.worktrees', 'node_modules']);

await main();

async function main() {
  const repoRoot = path.resolve(process.argv[2] ?? '.');
  const version = process.argv[3];
  const changelog = process.argv[4] ?? '';
  const rawTags = process.argv[5]?.trim();
  const tags = rawTags
    ? rawTags.split(',').map((tag) => tag.trim()).filter(Boolean)
    : ['latest'];

  if (!version) {
    throw new Error('Version is required');
  }

  const config = await readConfig();
  const files = await collectTextFiles(repoRoot);
  if (!files.some((file) => file.relPath.toLowerCase() === 'skill.md')) {
    throw new Error('SKILL.md required');
  }

  const form = new FormData();
  form.set(
    'payload',
    JSON.stringify({
      slug: 'cross-listing-ai',
      displayName: 'Cross Listing AI',
      version,
      changelog,
      tags,
      acceptLicenseTerms: true,
    }),
  );

  for (const file of files) {
    const blob = new Blob([file.bytes], { type: file.contentType });
    form.append('files', blob, file.relPath);
  }

  const response = await fetch(new URL('/api/v1/skills', config.registry), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${config.token}`,
    },
    body: form,
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(responseText || `ClawHub API publish failed with HTTP ${response.status}`);
  }

  const data = JSON.parse(responseText);
  if (!data?.ok) {
    throw new Error(responseText || 'ClawHub API publish failed');
  }

  console.log(`OK. Published cross-listing-ai@${version} (${data.versionId})`);
}

async function readConfig() {
  const configPath = resolveConfigPath();
  const raw = await readFile(configPath, 'utf8');
  const parsed = JSON.parse(raw);
  const token = parsed?.token?.trim();
  const registry = (parsed?.registry?.trim() || 'https://clawhub.ai').replace(/\/$/, '');

  if (!token) {
    throw new Error('Not logged in. Run: clawhub login');
  }

  return { token, registry };
}

function resolveConfigPath() {
  const override = process.env.CLAWHUB_CONFIG_PATH?.trim() ?? process.env.CLAWDHUB_CONFIG_PATH?.trim();
  if (override) {
    return path.resolve(override);
  }

  const home = os.homedir();
  if (process.platform === 'darwin') {
    return resolveConfigPathWithLegacyFallback(path.join(home, 'Library', 'Application Support'));
  }

  if (process.env.XDG_CONFIG_HOME) {
    return resolveConfigPathWithLegacyFallback(process.env.XDG_CONFIG_HOME);
  }

  if (process.platform === 'win32' && process.env.APPDATA) {
    return resolveConfigPathWithLegacyFallback(process.env.APPDATA);
  }

  return resolveConfigPathWithLegacyFallback(path.join(home, '.config'));
}

function resolveConfigPathWithLegacyFallback(baseDir) {
  const clawhubPath = path.join(baseDir, 'clawhub', 'config.json');
  const clawdhubPath = path.join(baseDir, 'clawdhub', 'config.json');

  if (existsSync(clawhubPath)) {
    return clawhubPath;
  }
  if (existsSync(clawdhubPath)) {
    return clawdhubPath;
  }

  return clawhubPath;
}

async function collectTextFiles(rootDir) {
  const files = [];
  await walk(rootDir, rootDir, files);
  return files.sort((left, right) => left.relPath.localeCompare(right.relPath));
}

async function walk(rootDir, currentDir, files) {
  const entries = await readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = path.relative(rootDir, absolutePath).split(path.sep).join('/');

    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) {
        continue;
      }
      await walk(rootDir, absolutePath, files);
      continue;
    }

    if (!entry.isFile() || !isTextFile(entry.name)) {
      continue;
    }

    const bytes = await readFile(absolutePath);
    files.push({
      relPath: relativePath,
      bytes,
      contentType: guessContentType(relativePath),
    });
  }
}

function isTextFile(filename) {
  if (filename === 'LICENSE') {
    return true;
  }

  return TEXT_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

function guessContentType(relativePath) {
  const extension = path.extname(relativePath).toLowerCase();

  if (extension === '.json') {
    return 'application/json';
  }
  if (extension === '.yaml' || extension === '.yml') {
    return 'application/yaml';
  }
  if (extension === '.md') {
    return 'text/markdown';
  }

  return 'text/plain';
}
