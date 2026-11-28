const kokonutSections = [
  [/导航|菜单/, 'navigation'],
  [/卡片|列表|图表|数据/, 'cards'],
  [/按钮|开关|主题/, 'buttons'],
  [/输入|上传|选择|调节|表单/, 'inputs'],
  [/背景|材质/, 'backgrounds'],
  [/文字|排版|打字/, 'texts'],
  [/图片|图集|轮播|播放器/, 'media'],
  [/加载|反馈/, 'feedback'],
];

export function registryComponentPage(registryUrl, category = '') {
  let url;
  try { url = new URL(registryUrl); } catch { return ''; }
  const slug = url.hostname === 'kokonutui.com' && url.pathname.match(/^\/r\/([a-z0-9-]+)\.json$/i)?.[1];
  const section = kokonutSections.find(([pattern]) => pattern.test(category))?.[1];
  return slug && section ? `https://kokonutui.com/docs/${section}/${slug}` : '';
}

export function registryAgentPrompt(record, sourceUrl = '') {
  if (record?.captureMethod !== 'registry' || !record.installCommand) return '';
  const source = sourceUrl ? `\n原组件页：${sourceUrl}` : '';
  return `请在当前项目中安装并使用「${record.name}」。\n\n先检查项目现有技术栈和组件目录，然后执行：\n${record.installCommand}${source}\n\n安装完成后，按当前项目的字体、颜色和圆角做适配，保留组件原有交互与动效。最后运行项目检查，并告诉我改了哪些文件、如何使用。`;
}
