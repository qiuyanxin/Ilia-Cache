const localMotionComponents = [
  {
    slug: 'swipe-deck',
    label: 'Swipe deck',
    name: 'Swipe deck · 滑动卡组',
    category: '卡片',
    description: '把网站叠成卡组，拖动浏览，向右加入精选。',
  },
  {
    slug: 'pull-cord',
    label: 'Pull cord',
    name: 'Pull cord · 拉绳开关',
    category: '按钮与输入',
    description: '拉动灯绳切换黑白主题，绳索和灯罩自然回弹。',
  },
];

export async function loadBuiltinComponents(read) {
  const motionLibrary = await read('/motion-library.json', 'json');
  const localMotion = await Promise.all(localMotionComponents.map(async ({ slug, label, name, category, description }) => {
    const url = `https://designbookmark.com/motion#db-${slug}`;
    const previewUrl = `/motion/${slug}.html`;
    return {
      id: `builtin-${slug}`,
      builtin: slug,
      name,
      url,
      category: '组件',
      kind: '案例',
      caseType: '组件',
      componentCategory: category,
      tags: [category, '弹簧动画', '原生 JavaScript'],
      description,
      cost: '免费',
      gets: '源码、提示词',
      note: description,
      created: new Date().toISOString(),
      prompt: `Add the "${label}" animated component to my project.

How it should look and move: ${url}
Code: https://designbookmark.com/motion-src/${slug}/index.html, with the CSS and JS files next to it and the shared springs in https://designbookmark.com/motion-src/shared/ (tokens.css, base.css, motion.js). It is plain HTML, CSS and JavaScript with no dependencies.

1. Read those files first, then look at my project.
2. Rebuild the component with what my project already uses. Keep the springs: the same stiffness and damping values from tokens.css, so it moves the same way.
3. Use my colors, fonts and corner radius, and write real text for my product in place of the demo text.
4. If I did not say where it goes, ask me before you add it to a page.
5. Run the project, check that it works, then tell me in simple words where to see it.`,
      files: [{ name: 'index.html', content: await read(previewUrl, 'text') }],
      previewUrl,
      mediaFetched: 'builtin',
    };
  }));
  return [...motionLibrary, ...localMotion];
}
