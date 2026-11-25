import assert from 'node:assert/strict';
import test from 'node:test';
import { buildComponentPreview } from '../preview-builder.mjs';

test('HTML preview keeps inline interaction and embeds uploaded local styling and scripts', async () => {
  const result = await buildComponentPreview({ files: [
    { name: 'demo/index.html', content: '<link rel="stylesheet" href="./theme.css"><button id="a">0</button><script src="./change.js"></script>' },
    { name: 'demo/theme.css', content: 'button{color:rebeccapurple}' },
    { name: 'demo/change.js', content: 'a.onclick=()=>a.textContent="1";' },
  ] });
  assert.equal(result.status, 'ready');
  assert.match(result.preview.srcdoc, /<style>button\{color:rebeccapurple\}<\/style>/);
  assert.match(result.preview.srcdoc, /<script>a\.onclick=/);
});

test('HTML preview reports a missing linked script', async () => {
  const result = await buildComponentPreview({ framework: 'html', files: [
    { name: 'index.html', content: '<script src="missing.js"></script>' },
  ] });
  assert.equal(result.status, 'needs-input');
  assert.match(result.message, /missing\.js/);
});

test('React preview builds TypeScript, local modules, dependencies and detected Tailwind utilities', async () => {
  const result = await buildComponentPreview({ framework: 'react', files: [
    { name: 'App.tsx', content: 'import {useState} from "react"; import {Moon} from "lucide-react"; import {label} from "./labels"; import "./demo.css"; export default function Demo() { const [n, setN] = useState<number>(0); return <button className="bg-sky-500" onClick={() => setN(n + 1)}><Moon />{label}: {n}</button> }' },
    { name: 'labels.ts', content: 'export const label: string = "Playwright demo";' },
    { name: 'demo.css', content: 'button { border-radius: 24px }' },
  ] });
  assert.equal(result.status, 'ready', result.message);
  assert.match(result.preview.srcdoc, /Playwright demo/);
  assert.match(result.preview.srcdoc, /\.bg-sky-500\s*\{/);
  assert.match(result.preview.srcdoc, /border-radius:24px/);
});

test('React reports project imports that are not provided in the local preview context', async () => {
  const result = await buildComponentPreview({ framework: 'react', files: [
    { name: 'index.tsx', content: 'import {Button} from "@/components/ui/button"; export default () => <Button>Demo</Button>' },
  ] });
  assert.equal(result.status, 'needs-input');
  assert.match(result.message, /@\/components\/ui\/button/);
});
