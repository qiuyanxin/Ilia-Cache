import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const directories = ['.', 'lib', 'public', 'public/motion-prompt-preview', 'scripts', 'test'];

for (const directory of directories) {
  const files = readdirSync(join(root, directory), { withFileTypes: true });
  const modules = files.filter(file => file.isFile() && /\.m?js$/.test(file.name));
  for (const name of modules.map(file => file.name).sort()) {
    const result = spawnSync(process.execPath, ['--check', join(directory, name)], {
      cwd: root,
      stdio: 'inherit',
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
