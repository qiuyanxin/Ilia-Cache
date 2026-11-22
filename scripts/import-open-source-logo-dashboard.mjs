import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const libraryUrl = new URL('data/library.json', root);
const library = JSON.parse(await readFile(libraryUrl, 'utf8'));
const created = '2026-11-22T00:00:00.000Z';

const logoSites = [
  ['simple-icons', 'Simple Icons', 'https://simpleicons.org/', 'https://github.com/simple-icons/simple-icons', '品牌 Logo SVG 库，适合查找常见产品和公司的标志。', '下载品牌 SVG；使用前核对该品牌的商标与单项许可。', 'CC0-1.0（项目）；品牌标志权利各自独立'],
  ['svgl', 'SVGL', 'https://svgl.app/', 'https://github.com/pheralb/svgl', '面向设计师和开发者的 SVG 品牌 Logo 目录，预览和复制都很直接。', '找科技品牌 Logo，并回到原品牌规范确认使用边界。', 'MIT（网站源码）；Logo 权利各自独立'],
  ['iconify', 'Iconify Icon Sets', 'https://icon-sets.iconify.design/', 'https://github.com/iconify/iconify', '聚合大量开源图标集，可按集合、名称和许可证检索。', '先选一套统一图标集，再为项目导航复制 SVG 或使用对应包。', '框架 MIT；每个图标集许可不同'],
  ['lucide', 'Lucide', 'https://lucide.dev/icons/', 'https://github.com/lucide-icons/lucide', '线条克制、尺寸统一的开源界面图标库。', '最适合当前 Cache 侧栏和按钮导航，保持统一的 24×24 轮廓风格。', 'ISC'],
  ['tabler-icons', 'Tabler Icons', 'https://tabler.io/icons', 'https://github.com/tabler/tabler-icons', '覆盖面很大的 24×24 开源 SVG 图标库，视觉一致。', 'Lucide 缺少具体图标时作为导航和后台界面的补充。', 'MIT'],
  ['phosphor-icons', 'Phosphor Icons', 'https://phosphoricons.com/', 'https://github.com/phosphor-icons/core', '提供多种粗细和填充方式的开源图标家族。', '需要更有性格或多字重状态的导航图标时使用。', 'MIT'],
].map(([slug, name, url, repository, finds, use, license]) => ({
  id: `website-open-logo-${slug}`,
  name,
  url,
  category: '审美与视觉',
  description: finds,
  finds,
  use,
  gets: 'SVG、源码',
  cost: '免费',
  tags: ['Logo', 'SVG', '开源图标'],
  kind: '网站',
  source: '开源 Logo 与图标研究',
  favorite: false,
  note: '开源代码许可不等于品牌商标可任意使用；对外发布前仍需核对具体图标的权利说明。',
  prompt: '',
  license,
  primarySourceUrl: repository,
  primarySourceKind: 'repository',
  sourcePolicy: 'source-link-only',
  created,
}));

const dashboards = [
  ['tabler', 'Tabler Admin', 'https://preview.tabler.io/', 'https://github.com/tabler/tabler', 'Bootstrap 5', '成熟的响应式后台模板，页面、组件、深色模式和 RTL 覆盖完整。', 'MIT'],
  ['orbynadmin', 'OrbynAdmin', 'https://orbynadmin.vercel.app/', 'https://github.com/masondevx/orbynadmin', 'Next.js、Tailwind CSS、shadcn/ui', '现代 SaaS 后台模板，包含大量页面和可直接改造的业务界面。', 'MIT'],
  ['kiranism-next-shadcn', 'Next Shadcn Dashboard Starter', 'https://dub.sh/shadcn-dashboard', 'https://github.com/Kiranism/next-shadcn-dashboard-starter', 'Next.js、TypeScript、shadcn/ui', '带表格、表单、认证和账单页面的完整后台起点。', 'MIT'],
  ['shadcn-dashboard', 'Shadcn Dashboard', 'https://shadcndashboard-demo.vercel.app/', 'https://github.com/shadcndashboard/next-shadcn-dashboard', 'Next.js、Tailwind CSS、shadcn/ui', '结构清楚的开源管理后台，适合学习侧栏、图表和内容布局。', 'MIT；README 要求保留署名'],
  ['tailadmin-react', 'TailAdmin React', 'https://tailadmin.com/react', 'https://github.com/TailAdmin/free-react-tailwind-admin-dashboard', 'React、TypeScript、Tailwind CSS', '组件和数据展示较完整的 React 后台模板。', 'MIT'],
  ['admin-one', 'Admin One', 'https://justboil.github.io/admin-one-react-tailwind/', 'https://github.com/justboil/admin-one-react-tailwind', 'Next.js、React、Tailwind CSS', '轻量的开源后台模板，含深色模式和常用数据界面。', 'MIT'],
].map(([slug, name, livePreview, repository, stack, description, license]) => ({
  id: `page-dashboard-open-${slug}`,
  name,
  originalName: name,
  url: livePreview,
  livePreview,
  category: '页面模板',
  kind: '案例',
  caseType: '网页参考',
  pageCategory: 'Dashboard',
  sourceCategory: 'GitHub 开源',
  description,
  note: `技术栈：${stack}。使用前查看仓库 README 和最新许可。`,
  prompt: '',
  promptKind: 'reference',
  promptStatus: '设计参考',
  source: 'GitHub 开源模板',
  sourceShort: 'GitHub 开源',
  collectionSource: { name: 'GitHub', url: repository },
  primarySourceUrl: repository,
  primarySourceKind: 'repository',
  sourcePolicy: 'source-link-only',
  media: [],
  tags: ['Dashboard', '开源源码', stack],
  cost: '免费',
  access: 'free',
  license,
  gets: '在线预览、GitHub 源码',
  favorite: false,
  created,
}));

const existingIds = new Set(library.resources.map((item) => item.id));
const additions = [...logoSites, ...dashboards].filter((item) => !existingIds.has(item.id));
library.resources.push(...additions);
library.siteOverrides = {
  ...(library.siteOverrides || {}),
  '21st.dev': { ...(library.siteOverrides?.['21st.dev'] || {}), previewable: true },
  '100font.com': { ...(library.siteOverrides?.['100font.com'] || {}), previewable: false },
};
library.updatedAt = new Date().toISOString();
await writeFile(libraryUrl, `${JSON.stringify(library, null, 2)}\n`);
console.log(`新增 ${additions.length} 条：${additions.filter((item) => item.pageCategory).length} 个 Dashboard，${additions.filter((item) => !item.pageCategory).length} 个 Logo/图标网站。`);
