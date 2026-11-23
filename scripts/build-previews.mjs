import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPublicPreviews } from './build-public-previews.mjs';

const root = new URL('../', import.meta.url);
const archiveManifest = new URL('references/designbookmark/react-previews.json', root);

let hasArchive = true;
try {
  await access(archiveManifest);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  hasArchive = false;
}

if (hasArchive) {
  const npmEntry = process.env.npm_execpath;
  const command = npmEntry ? process.execPath : 'npm';
  const args = [...(npmEntry ? [npmEntry] : []), 'run', 'build:previews:archive'];
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: 'inherit',
      shell: !npmEntry && process.platform === 'win32',
    });
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
  process.exitCode = exitCode;
} else {
  const output = await buildPublicPreviews();
  console.log('已生成公开 React 示例：' + relative(fileURLToPath(root), output));
}
