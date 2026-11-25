const han = /\p{Script=Han}/u;
const isEnglishName = value => /[a-z]/i.test(value) && !han.test(value);

export function componentEnglishName(resource) {
  const original = resource.originalName?.split(/\s+[·|]\s+/).map(part => part.trim()).find(isEnglishName);
  if (original) return { name: original, original: true };
  const bilingualName = resource.name?.split(' · ').find(isEnglishName);
  if (bilingualName) return { name: bilingualName, original: true };
  if (resource.id === 'builtin-spinning-counter') return { name: 'Spinning Counter', original: true };
  const slug = /^https:\/\/leibox\.pantoria\.cn\/docs\/(?:animations|components)\/([a-z0-9-]+)\/?(?:[?#].*)?$/i.exec(resource.url)?.[1];
  if (!slug) return null;
  const name = slug.split('-').map(word => /^(ascii|css|svg|ui|3d)$/i.test(word)
    ? word.toUpperCase() : word.charAt(0).toUpperCase()+word.slice(1)).join(' ');
  return { name, original: false };
}

const translatedDescriptions = {
  'fae5e50c-9da3-4e6b-8db0-c6d811a693ea': '打开玻璃文件夹时，层叠的内容卡片向外展开。',
  'builtin-spinning-counter': '数值变化时通过滚动数字呈现计数过程。',
  '4cbfeca4-e4db-402e-8b1f-a1aa0aa96012': '拖动分隔线比较两张图片，松开时边界自然回弹。',
  'b8c03de3-a582-4489-a7a0-def7eca7afb1': '拖动玻璃透镜穿过像素房间，从白天聊天切换到夜间专注。',
  'honest-stingray-90': '点击时旋转日月图标，切换浅色与深色。',
  'fresh-fireant-15': '在方形控件里用月相变化表现主题切换。',
  'angry-starfish-78': '以一明一暗两道阴影表现浅色滑块的立体感。',
  'great-skunk-8': '滑块沿凹入的轨道移动，显示开关状态。',
  'popular-seahorse-73': '用圆形浮雕和边缘高光区分开关状态。',
  'itchy-turtle-45': '滑动时在白天和夜晚两种画面间切换。',
  'nice-insect-63': '玻璃表面与发光边缘叠出立体层次。',
  'grumpy-lizard-55': '在方形按钮上结合磨砂表面和悬停高光。',
  'big-horse-30': '透明玻璃按钮配合投影呈现悬浮感。',
  'brown-gecko-29': '悬停时液体色层填入按钮，突出可点击状态。',
  'selfish-goat-90': '按下时缩短硬边投影，模拟实体按钮下沉。',
  'unlucky-rat-66': '用像素轮廓和图标呈现下载入口。',
  'polite-mole-15': '发光描边与霓虹渐变呈现复古街机风格。',
  'neat-goat-26': '内容载入前，用扫过的高光标示骨架卡片。',
  'spinkit-plane': '方片反复翻转，提示内容正在加载。',
  'spinkit-chase': '六个圆点沿圆周追逐，提示加载状态。',
  'spinkit-grid': '九个方块依次缩放，形成波动的网格。',
  'three-dots-elastic': '三个圆点依次伸缩，表示短暂等待。',
  'three-dots-flashing': '三个圆点交替明暗，用于等待反馈。',
  'nes-primary': '像素边框与阶梯状边角构成复古主按钮。',
  'afraid-eel-50': '圆形滑块沿胶囊轨道移动，标明开关状态。',
  'sour-horse-29': '用简洁的轨道与滑块切换两种状态。',
  'curly-firefox-62': '用红色与绿色区分关闭和开启状态。',
  'friendly-otter-40': '滑块切换时先挤压，再弹回原形。',
  'unlucky-turkey-88': '通过凹槽、材质和滑块模仿机械开关。',
  'evil-lion-15': '用凸起和凹陷的光影区分控件状态。',
  'lovely-firefox-94': '柔和阴影让开关从同色底面微微凸起。',
  'strong-lizard-79': '用日月插画表现浅色和深色两种主题。',
  'shy-earwig-18': '用紧凑的日月控件切换主题。',
  'light-jellyfish-4': '暗色背景里的发光滑块指示主题状态。',
  'brown-termite-67': '滑盖移动时露出另一侧的日月图标。',
  'splendid-liger-23': '用两种色块和圆角外形区分主题状态。',
  'short-bird-25': '暗色玻璃表面的流动扫光提供悬停反馈。',
  'chatty-tiger-70': '玻璃按钮用发光边缘勾勒轮廓。',
  'wonderful-owl-61': '以半透明粉色渐变表现玻璃质感。',
  'tender-dolphin-96': '在透明按钮表面用水波表现交互反馈。',
  'tall-mayfly-66': '波浪色层沿按钮弧面移动，表现液体的立体感。',
  'curvy-tiger-34': '以玻璃底层上的涟漪表现交互反馈。',
  'heavy-dragon-15': '用按键位移和硬边阴影表现复古按压手感。',
  'plastic-panther-51': '旋转的渐变圆环提示等待状态。',
  'nervous-sheep-18': '竖条轮流变化高度，形成加载节奏。',
  'wise-moose-53': '用细横线呈现加载进度。',
  'lazy-goat-96': '以动画强调进度条的推进过程。',
  'witty-deer-83': '用上升的水位和波浪表现加载进度。',
  'pretty-mouse-82': '在柔光玻璃面板里呈现加载状态。',
  'georapbox-theme-switcher': '在浅色、深色和跟随系统三种设置间选择。',
  'georapbox-theme-toggle': '每次点击依次切换浅色、深色和系统主题。',
};

export function componentCardDescription(resource) {
  return [resource.note, resource.description].find(text => text && han.test(text))
    || translatedDescriptions[resource.id]
    || translatedDescriptions[resource.id.replace(/^interaction-/, '')]
    || '';
}
