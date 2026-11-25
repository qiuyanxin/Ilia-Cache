import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildComponentPreview } from '../preview-builder.mjs';

const fixtureUrl = new URL('./preview-fixtures/counter.tsx', import.meta.url);
const defaultDirectory = fileURLToPath(new URL('../public/imported-react/', import.meta.url));

export async function buildPublicPreviews(outputDirectory = defaultDirectory) {
  const content = await readFile(fixtureUrl, 'utf8');
  const result = await buildComponentPreview({
    files: [{ name: 'counter.tsx', content }],
    framework: 'react',
  });

  if (result.status !== 'ready') {
    throw new Error(result.message || '公开 React 示例构建失败。');
  }

  await mkdir(outputDirectory, { recursive: true });
  const output = resolve(outputDirectory, 'ilia-preview-counter.html');
  await writeFile(output, result.preview.srcdoc, 'utf8');
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildPublicPreviews();
  console.log('已生成公开 React 示例：public/imported-react/ilia-preview-counter.html');
}
