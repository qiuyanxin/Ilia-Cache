import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const libraryUrl = new URL('data/library.json', root);
const library = JSON.parse(await readFile(libraryUrl, 'utf8'));

const framer = [
  ['valerina', 'Valerina', 'Denysfs', '作品集', 'https://valerina.framer.website', 'https://framerusercontent.com/images/xN5rtdwcMqB3AtnXNi1MhbNNYY.png', '精致的编辑感创意总监与设计师作品集。'],
  ['bookshelf', 'Bookshelf', 'Yaren Pamuk', '内容与行业', 'https://shelfofbooks.framer.website', 'https://framerusercontent.com/images/quKmBWEn09FprQ1GLD55wlq8.png', '用 CMS 记录阅读、评分与书摘的个人书架。'],
  ['billie', 'Billie', 'Gustave Flowbert', '作品集', 'https://billie-duvalle.framer.website', 'https://framerusercontent.com/images/t5l1jrraIetI7FK4zYG7M90wbFE.png', '带沉浸式悬停与平滑滚动的创意作品集。'],
  ['k-nstler', 'Künstler', 'Soo Lee', '作品集', 'https://serinmedia.framer.website', 'https://framerusercontent.com/images/w9tR8Vr5LofDhlaMA1xaRmS5JU.png', '面向当代艺术家与画廊的极简作品和展览档案。'],
  ['ma-l-blanc', 'Maël Blanc', 'Jamik', '作品集', 'https://mael-blanc.framer.website', 'https://framerusercontent.com/images/Tp8g3sV7bwu2r6LygZFdRtvqwU.png', '包含案例、服务 CMS 与设计系统的编辑式作品集。'],
  ['aren-vale', 'Aren Vale', 'Nurmukhammad', '作品集', 'https://arenvale.framer.photos', 'https://framerusercontent.com/images/WWfXUtvYRKt8F47KDqC9tf5rHY.jpg', '以照片为主角并带弧形 GPU 画廊的摄影作品集。'],
  ['lottie', 'Lottie', 'Ambie', '作品集', 'https://lottie-portfolio.framer.website', 'https://framerusercontent.com/images/7yxcFqglOUVu9zsx8yNjbY6K6I.png', '色彩鲜明、互动丰富的时尚与文化创意作品集。'],
  ['primavera-collection', 'Primavera Collection', 'Oleksandr Demydov', '实验与动效', 'https://primavera-collection.framer.website', 'https://framerusercontent.com/images/XiO7kXT1PkOctd66nr2Njdf4wtk.jpg', '用 Three.js 布料幕布揭开内容的发布预告页。'],
  ['creatie', 'Creatie', 'Talha Nawaz', '作品集', 'https://creatiie.framer.website', 'https://framerusercontent.com/images/SH2m0pFPxiO8aVxuEubFLarw.png', '带拖拽图形和视线跟随交互的活泼设计师作品集。'],
  ['nostalgia-computer', 'Nostalgia Computer', 'Real Mehedi', '作品集', 'https://retro-pc.framer.website', 'https://framerusercontent.com/images/b0Cw6RvNk1i4bELp6rjRYmk3MIo.png', '把页面做成可拖动窗口的复古 CRT 电脑作品集。'],
  ['le-reve', 'Le Rêve', 'Arian', '品牌与机构', 'https://xn--lerve-jsa.framer.website', 'https://framerusercontent.com/images/VyXIXFof8BfKsGSt5iZjTK88Wo.png', '以大字、流动排版和 CMS 展示项目的创意机构模板。'],
  ['carme', 'Carme', 'CocoBasic', '作品集', 'https://carme.framer.website', 'https://framerusercontent.com/images/KysqPULvOKAunw8CzhpSOaFPCGo.png', '留白克制、突出项目与个人故事的现代作品集。'],
  ['finn', 'Finn', 'Typefool', '作品集', 'https://finn.framer.media', '', '带光标图片轨迹和粗体排版的自由职业者作品集。'],
  ['dozen', 'Dozen', 'BuiltByKern', '电商与品牌', 'https://dozen.framer.website', 'https://framerusercontent.com/images/jyLl0OGE3MFSwHJy5TAezfRzM.jpg', '围绕每周批次预订和 3D 包装叙事的烘焙品牌网站。'],
  ['dorok', 'Dorok', 'Semantic Ground', '作品集', 'https://dorok.framer.website', 'https://framerusercontent.com/assets/MekeHvISjS7GjQdefN1qrwcJkc4.png', '以目录结构组织作品、展览和艺术档案的极简模板。'],
].map(([slug, name, author, pageCategory, livePreview, image, description]) => {
  const marketplaceUrl = `https://www.framer.com/marketplace/templates/${slug}/`;
  const paid = slug === 'dorok';
  return {
    id: `page-framer-${slug}`,
    name,
    originalName: name,
    url: marketplaceUrl,
    category: '页面模板',
    kind: '案例',
    caseType: '网页参考',
    pageCategory,
    sourceCategory: 'Framer Template',
    description,
    note: paid ? '官方页面标价 30 美元；购买前重新核对价格和许可。' : '官方页面提供 Remix for Free；使用时仍须遵守模板的 Limited 许可。',
    prompt: '',
    promptKind: 'reference',
    promptStatus: '设计参考',
    source: 'Framer Marketplace',
    sourceShort: 'Framer',
    collectionSource: { name: 'Framer Marketplace', url: 'https://www.framer.com/marketplace/templates/' },
    primarySourceAuthor: author,
    primarySourceUrl: marketplaceUrl,
    primarySourceKind: 'template',
    sourcePolicy: 'source-link-only',
    livePreview,
    preview: image,
    media: image ? [{ type: 'image', url: image }] : [],
    tags: [pageCategory, 'Framer', paid ? '付费模板' : '免费 Remix'],
    cost: paid ? '$30' : '免费',
    access: paid ? 'paid' : 'free',
    license: paid ? 'Single-Use；以官方模板页为准' : 'Limited；可 Remix，不得转售或重新分发模板',
    gets: paid ? '在线预览、购买入口' : '在线预览、Framer Remix',
  };
});

const twentyFirst = [
  ['ai-voice-agent-landing-page', 'AI Voice Agent Landing Page', 'SaaS', 'https://kedhar-components.pages.dev/media/cairn-agents-landing/template-cover.jpg', 'AI 语音智能体产品落地页。'],
  ['magic-portfolio-for-next-js', 'Magic Portfolio for Next.js', '作品集', 'https://vucvdpamtrjkzmubwlts.supabase.co/storage/v1/render/image/public/templates/user_2nElBLvklOKlAURm6W1PTu6yYFh/magic-portfolio-for-next-js/preview.jpg?width=640&quality=75&resize=contain', '使用 Next.js 构建的模块化个人作品集。', 'larsen66', 'David Hakobyan'],
  ['astronomy-club-website-template-with-bubble-poster-design', 'Astronomy Club Bubble Poster', '实验与动效', 'https://cdn.21st.dev/cdn-cgi/image/fit=scale-down,width=640,quality=75,format=webp/https://cdn.21st.dev/user_30fkm37UoBFJx1GiK2Q4Sy8lSrO/templates/astronomy-club-website-template-with-bubble-poster-design/preview-1791311759596.png', '带气泡海报视觉的天文社群网站。'],
  ['photo-album-scroll-website-template', 'Photo Album Scroll', '作品集', 'https://cdn.21st.dev/cdn-cgi/image/fit=scale-down,width=640,quality=75,format=webp/https://cdn.21st.dev/user_30fkm37UoBFJx1GiK2Q4Sy8lSrO/templates/photo-album-scroll-website-template/preview-1794607895940.png', '用滚动浏览影集的摄影作品页面。'],
  ['design-studio-website-template', 'Design Studio', '品牌与机构', 'https://cdn.21st.dev/cdn-cgi/image/fit=scale-down,width=640,quality=75,format=webp/https://cdn.21st.dev/user_30fkm37UoBFJx1GiK2Q4Sy8lSrO/templates/design-studio-website-template/preview-1793897990060.png', '完整的设计工作室品牌展示网站。'],
  ['page-flip-recipe-book-template', 'Page Flip Recipe Book', '内容与行业', 'https://cdn.21st.dev/cdn-cgi/image/fit=scale-down,width=640,quality=75,format=webp/https://cdn.21st.dev/user_30fkm37UoBFJx1GiK2Q4Sy8lSrO/templates/page-flip-recipe-book-template/preview-1793601617168.png', '使用翻页交互浏览菜谱的内容网站。'],
  ['coffee-roaster-landing-page-template', 'Coffee Roaster', '电商与品牌', 'https://cdn.21st.dev/cdn-cgi/image/fit=scale-down,width=640,quality=75,format=webp/https://cdn.21st.dev/user_30fkm37UoBFJx1GiK2Q4Sy8lSrO/templates/coffee-roaster-landing-page-template/preview-1793601546074.png', '强调产地和工艺的咖啡烘焙品牌落地页。'],
  ['henna-shop-ecommerce-template', 'Henna Shop Ecommerce', '电商与品牌', 'https://kedhar-components.pages.dev/media/mehndi-atelier-template/template-cover.jpg', '面向海娜产品与服务的视觉化电商页面。'],
  ['botanical-3d-flower-landing-page', 'Botanical 3D Flower', '实验与动效', 'https://kedhar-components.pages.dev/media/florilegium-template/template-cover.jpg', '以 3D 花卉作为核心视觉的品牌落地页。'],
  ['illustration-portfolio-template-with-painted-cover', 'Painted Illustration Portfolio', '作品集', 'https://cdn.21st.dev/cdn-cgi/image/fit=scale-down,width=640,quality=75,format=webp/https://cdn.21st.dev/user_30fkm37UoBFJx1GiK2Q4Sy8lSrO/templates/illustration-portfolio-template-with-painted-cover/preview-1791311785510.png', '带手绘封面表达的插画师作品集。'],
  ['card-stack-portfolio-website-template', 'Card Stack Portfolio', '作品集', 'https://cdn.21st.dev/cdn-cgi/image/fit=scale-down,width=640,quality=75,format=webp/https://cdn.21st.dev/kedhareswer/pocket-portfolio/default/preview.1790787494909-e90b681d-4268-4373-9e5f-980cb35d86d5.png', '使用层叠卡片组织项目的个人作品集。'],
  ['developer-portfolio-template-with-sticky-sidebar', 'Sticky Sidebar Developer Portfolio', '作品集', 'https://cdn.21st.dev/cdn-cgi/image/fit=scale-down,width=640,quality=75,format=webp/https://cdn.21st.dev/kedhareswer/sidebar-portfolio-template/default/preview.1790787432379-305e0311-faef-49ce-8a04-0440718de7dc.png', '以固定侧栏组织经历与项目的开发者作品集。'],
  ['coquette-macos-desktop-portfolio-template', 'Coquette macOS Portfolio', '作品集', 'https://cdn.21st.dev/cdn-cgi/image/fit=scale-down,width=640,quality=75,format=webp/https://cdn.21st.dev/kedhareswer/coquette-desktop-portfolio/default/preview.1790787318142-3fff6876-8549-4d6d-867d-4d16686d9e8e.png', '把个人作品做成柔和复古 macOS 桌面的互动模板。'],
  ['handwritten-notes-landing-page', 'Handwritten Notes', '内容与行业', 'https://kedhar-components.pages.dev/media/longhand-notes-landing/template-cover.jpg', '以手写笔记和纸张质感组织内容的落地页。'],
  ['sauna-booking-landing-page', 'Sauna Booking', '内容与行业', 'https://kedhar-components.pages.dev/media/loyly-sauna-landing/template-cover.jpg', '兼顾品牌氛围和预约信息的桑拿服务页面。'],
  ['orbit-mail', 'Orbit Mail', 'SaaS', 'https://cdn.21st.dev/cdn-cgi/image/fit=scale-down,width=1080,quality=75,format=webp/https://cdn.21st.dev/user_2zxiDlyxY96s67p94sGoEXo2PsN/templates/orbit-mail/preview-1782388077950.png', '面向开发者的现代邮件营销与活动页面。', 'nextjsshop', 'nextjs shop'],
  ['treasury-management-fintech-landing-page', 'Treasury Management Fintech', 'SaaS', 'https://kedhar-components.pages.dev/media/teal-treasury-landing/template-cover.jpg', '包含余额、图表和转账界面的财资管理金融科技落地页。'],
  ['fintech-landing-page-template-with-flower-meadow-hero', 'Fintech Flower Meadow', 'SaaS', 'https://cdn.21st.dev/cdn-cgi/image/fit=scale-down,width=1080,quality=75,format=webp/https://cdn.21st.dev/user_30fkm37UoBFJx1GiK2Q4Sy8lSrO/templates/fintech-landing-page-template-with-flower-meadow-hero/preview-1791311817218.png', '以花海插画和金属钱币构成首屏的金融应用落地页。'],
  ['experience-design', 'Experience Design', '品牌与机构', 'https://cdn.21st.dev/cdn-cgi/image/fit=scale-down,width=1080,quality=75,format=webp/https://cdn.21st.dev/user_3LlrNyzVpYjXgoHkqG1SrfhhukF/templates/experience-design/preview-1794607746689.png', '突出体验设计与视觉叙事的完整工作室网站。', 'admin-pstzxid', 'pstzx'],
  ['playful-brand-scroll-landing-page', 'Playful Brand Scroll', '电商与品牌', 'https://cdn.21st.dev/cdn-cgi/image/fit=scale-down,width=1080,quality=75,format=webp/https://cdn.21st.dev/user_30fkm37UoBFJx1GiK2Q4Sy8lSrO/templates/playful-brand-scroll-landing-page/preview-1793601408310.png', '用滚动动画和大胆排版展开品牌故事的落地页。'],
  ['design-studio-agency-landing-page', 'Design Studio Agency', '品牌与机构', 'https://kedhar-components.pages.dev/media/overstory-studio-landing/template-cover.jpg', '面向创意工作室和设计机构的品牌及项目展示页。'],
  ['ai-agent-platform-landing-page', 'AI Agent Platform', 'SaaS', 'https://kedhar-components.pages.dev/media/tessel-agent-landing/template-cover.jpg', '用于介绍 AI Agent 平台、功能和使用流程的产品站。'],
  ['meal-planning-app-landing-page', 'Meal Planning App', '内容与行业', 'https://kedhar-components.pages.dev/media/fuelplate-recipes-template/template-cover.jpg', '展示食谱、膳食计划和产品价值的应用落地页。'],
  ['designer-cv-portfolio-template', 'Designer CV Portfolio', '作品集', 'https://kedhar-components.pages.dev/media/marginalia-portfolio-template/template-cover.jpg', '把简历、项目和个人经历组织在一起的设计师作品集。'],
  ['ai-customer-support-landing-page', 'AI Customer Support', 'SaaS', 'https://kedhar-components.pages.dev/media/mallow-support-template/template-cover.jpg', '面向 AI 客服与工单产品的软件落地页。'],
  ['investing-platform-landing-page', 'Investing Platform', 'SaaS', 'https://kedhar-components.pages.dev/media/stipple-orb-landing/template-cover.jpg', '展示投资数据、产品优势和行动入口的金融平台网站。'],
  ['satellite-imaging-landing-page', 'Satellite Imaging', '内容与行业', 'https://cdn.21st.dev/cdn-cgi/image/fit=scale-down,width=1080,quality=75,format=webp/https://cdn.21st.dev/user_30fkm37UoBFJx1GiK2Q4Sy8lSrO/templates/satellite-imaging-landing-page/preview-1792092027798.png', '以卫星数据和地球观测为主视觉的科技服务站。'],
  ['hiking-tour-landing-page', 'Hiking Tour', '内容与行业', 'https://cdn.21st.dev/cdn-cgi/image/fit=scale-down,width=1080,quality=75,format=webp/https://cdn.21st.dev/user_30fkm37UoBFJx1GiK2Q4Sy8lSrO/templates/hiking-tour-landing-page/preview-1792091917466.png', '包含路线、风景和预订信息的徒步旅行落地页。'],
  ['fintech-saas-landing-page-template', 'Fintech SaaS', 'SaaS', 'https://cdn.21st.dev/cdn-cgi/image/fit=scale-down,width=1080,quality=75,format=webp/https://cdn.21st.dev/user_30fkm37UoBFJx1GiK2Q4Sy8lSrO/templates/fintech-saas-landing-page-template/preview-1791311595509.png', '信息层级完整的金融 SaaS 产品官网。'],
  ['ai-saas-landing-page-template-with-3d-hero', 'AI SaaS 3D Hero', 'SaaS', 'https://cdn.21st.dev/cdn-cgi/image/fit=scale-down,width=1080,quality=75,format=webp/https://cdn.21st.dev/user_30fkm37UoBFJx1GiK2Q4Sy8lSrO/templates/ai-saas-landing-page-template-with-3d-hero/preview-1791311921065.png', '用可拖动的 3D 墨水形态构成首屏的 AI SaaS 落地页。'],
].map(([slug, name, pageCategory, image, description, handle = 'kedhareswer', author = 'Kedhareswer Naidu']) => {
  const templateUrl = `https://21st.dev/@${handle}/templates/${slug}`;
  return {
    id: `page-21st-${slug}`,
    name,
    originalName: name,
    url: templateUrl,
    category: '页面模板',
    kind: '案例',
    caseType: '网页参考',
    pageCategory,
    sourceCategory: '21st.dev Free Template',
    description,
    note: '来自 21st.dev 官方 Free 分类；下载、安装和后续使用以模板页及上游仓库的当前许可为准。',
    prompt: '',
    promptKind: 'reference',
    promptStatus: '设计参考',
    source: '21st.dev Templates',
    sourceShort: '21st.dev',
    collectionSource: { name: '21st.dev Templates', url: 'https://21st.dev/community/templates/free' },
    primarySourceAuthor: author,
    primarySourceUrl: templateUrl,
    primarySourceKind: 'template',
    sourcePolicy: 'source-link-only',
    preview: image,
    media: [{ type: 'image', url: image }],
    tags: [pageCategory, '21st.dev', '免费模板', 'React', 'Next.js'],
    cost: '免费',
    access: 'free',
    license: '以模板页和上游仓库标注为准；未在本地归档源码',
    gets: '在线预览、模板入口；下载或安装依 21st.dev 当前权限',
  };
});

const records = [...framer, ...twentyFirst];
const now = new Date().toISOString();
let added = 0;
let updated = 0;

for (const record of records) {
  const existing = library.resources.find((item) =>
    item.id === record.id || item.primarySourceUrl === record.primarySourceUrl || item.url === record.url
  );
  const stamped = { ...record, importedAt: existing?.importedAt || now, created: existing?.created || now };
  if (existing) {
    Object.assign(existing, stamped);
    updated += 1;
  } else {
    library.resources.push(stamped);
    added += 1;
  }
}

library.updatedAt = now;
await writeFile(libraryUrl, JSON.stringify(library, null, 2));

console.log(JSON.stringify({ added, updated, framer: framer.length, twentyFirst: twentyFirst.length }, null, 2));
