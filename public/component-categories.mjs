export const COMPONENT_CATEGORY_GROUPS = {
  '开关与主题': ['基础开关', '拟态开关', '主题切换', '主题设置'],
  '按钮效果': ['玻璃按钮', '流体按钮', '复古按钮'],
  '界面交互': ['按钮与表单', '导航与菜单', '弹窗与浮层', '加载动画', '加载与反馈', '光标与拖拽'],
  '内容展示': ['图片、图集与轮播', '卡片与列表', '文字与排版', '图表与数据'],
  '视觉与动效': ['滚动与页面切换', '背景与材质', '摄影与画风', '动画技法', '镜头与剪辑'],
};

export const COMPONENT_BROWSE_GROUPS = {
  '图片': ['图集与相册', '轮播', '灯箱与放大', '图片对比', '图片动效'],
  '文字': ['排版', '文字入场', '打字与滚动', '文字特效'],
  '按钮': ['基础按钮', '悬停与按压', ...COMPONENT_CATEGORY_GROUPS['按钮效果']],
  '卡片': ['内容卡片', '列表', '堆叠与切换', '翻转与展开'],
  '播放器': ['音乐播放器', '视频播放器', '播放控制与进度条'],
  '开关': COMPONENT_CATEGORY_GROUPS['开关与主题'],
  '表单': ['输入与上传', '选择与调节'],
  '导航': ['导航与菜单'],
  '弹窗': ['弹窗与浮层'],
  '加载与反馈': ['加载动画', '加载与反馈'],
  '光标与拖拽': ['光标与拖拽'],
  '图表与数据': ['图表与数据'],
  '滚动与转场': ['滚动与页面切换'],
  '背景与材质': ['背景与材质'],
};

const browseCategories = new Set(Object.values(COMPONENT_BROWSE_GROUPS).flat());
export const COMPONENT_CATEGORIES = [
  ...new Set([...browseCategories, ...Object.values(COMPONENT_CATEGORY_GROUPS).flat(), '音效']),
];

const legacy = {
  '按钮与输入': '按钮与表单',
  '菜单与导航': '导航与菜单',
  '图集与轮播': '图片、图集与轮播',
  '卡片': '卡片与列表',
  '文字': '文字与排版',
  '文���': '文字与排版',
  '提示与状态': '加载与反馈',
  '拖拽与编辑': '光标与拖拽',
  '页面与转场': '滚动与页面切换',
  '动效与镜头': '动画技法',
  '视觉风格': '摄影与画风',
  '图表与图解': '图表与数据',
  '表面与质感': '背景与材质',
  '背景与物体': '背景与材质',
};

export function componentCategory(resource) {
  const saved = resource.componentCategory;
  if (resource.soundRecipe) return '音效';
  if (COMPONENT_CATEGORIES.includes(saved)) return saved;

  const name = [resource.name, resource.originalName].filter(Boolean).join(' ');
  const identity = `${resource.id || ''} ${resource.url || ''}`;
  if (/^motion-prompt-/.test(resource.id || '') && ['camera', 'camera2'].includes(resource.tags?.[1])) return '镜头与剪辑';

  // Match what the component does before using its former grouping.
  if (/粒子上传|下拉选择框|滚轮选项|卡片输入框|语音输入|提示词输入框|购物车按钮|实时校验|浮动标签/.test(name)) return '按钮与表单';
  if (/汉堡菜单|面包屑导航|巨型菜单|标签页|分段控制器|导航|回到顶部|分页|向下滚动提示/.test(name)) return '导航与菜单';
  if (/弹窗|对话框|工具授权|浮动提示|变形提示|气泡卡片|流体提示气泡|变形浮层|分享邀请面板|访问申请展开|抽屉面板|底部面板/.test(name)) return '弹窗与浮层';
  if (/轮播|相册|照片墙|图片对比|对比滑块|卡片轮换|卡片堆叠切换|堆叠卡片|扇形卡组|滑动卡组|弹性卡片|拖甩照片卡片|灯箱|图片热点|悬停切换图片|悬停图片预览|色彩图片网格|玻璃播放器|蜘蛛牵引切歌|语音浮光/.test(name) ||
      /carousel|gallery|slideshow|image-compare|card-(swap|stack)|scroll-stack|bounce-cards/i.test(identity)) return '图片、图集与轮播';
  if (/预加载|加载按钮|下拉刷新|面容解锁|通知堆叠|变形信息岛|倒计时|点赞动画|加载转成功/.test(name)) return '加载与反馈';
  if (/数字递增|数字平滑变化|滚动数字计数|数字弹入|滚动计数器|存储容量条|液体仪表/.test(name)) return '图表与数据';
  if (/光标跟随|点击火花|十字准星|选框拖拽|日历惯性拖拽|磁吸跟随|多光标页面搭建/.test(name)) return '光标与拖拽';
  if (/文字|排版|字体|打字机|text|type/i.test(name) && ['动画技法','滚动与页面切换'].includes(legacy[saved])) return '文字与排版';
  if (/玻璃透镜|冰霜|动态渐变|背景视频|流体金属/.test(name)) return '背景与材质';

  if (legacy[saved]) return legacy[saved];
  if (/text|split|type/i.test(identity)) return '文字与排版';
  if (/button|input|cord|slider/i.test(identity)) return '按钮与表单';
  if (/background|shader/i.test(identity)) return '背景与材质';
  return '卡片与列表';
}

export function componentBrowseCategory(resource) {
  const category = componentCategory(resource);
  if (browseCategories.has(category)) return category;

  const name = [resource.name, resource.originalName].filter(Boolean).join(' ');
  const identity = [name, resource.id, resource.url].filter(Boolean).join(' ');
  const isCardSet = /卡组|堆叠.*卡|卡.*堆叠|卡片轮换|弹性卡片|card[- ]stack|card[- ]swap|swipe[- ]deck|bounce[- ]cards/i.test(identity);

  switch (category) {
    case '图片、图集与轮播':
    case '卡片与列表':
      if (/视频播放器|video[- ]player/i.test(identity)) return '视频播放器';
      if (/播放器|切歌|音乐控制|播放条|(?:music|audio|glass)[- ]player|vinyl[- ]player/i.test(identity)) return '音乐播放器';
      if (isCardSet && !/相册|照片|图片|gallery/i.test(name)) return '堆叠与切换';
      if (category === '卡片与列表') {
        if (/翻转|展开|折叠|flipp?ing|flip[- ]card/i.test(identity)) return '翻转与展开';
        return /列表|\blist\b/i.test(name) ? '列表' : '内容卡片';
      }
      if (/对比|image[- ]compare|before[- ]after/i.test(identity)) return '图片对比';
      if (/灯箱|放大|lightbox/i.test(identity)) return '灯箱与放大';
      if (/轮播|carousel|slideshow/i.test(identity)) return '轮播';
      if (/图集|相册|照片墙|图片网格|专辑封面|gallery|album/i.test(identity)) return '图集与相册';
      return '图片动效';
    case '文字与排版':
      if (/入场|显现|reveal|entrance/i.test(identity)) return '文字入场';
      if (/打字|流式文字|滚动|typewriter|typing/i.test(identity)) return '打字与滚动';
      if (/排版|路径文字|环形文字|弧形文字|字重|可变字体|typography/i.test(identity)) return '排版';
      return '文字特效';
    case '按钮与表单':
      if (/像素日夜|theme[- ]toggle|dark[- ]mode[- ]toggle/i.test(identity)) return '主题切换';
      if (/开关|拉绳|pull[- ]cord|\bswitch\b|\btoggle\b/i.test(identity)) return '基础开关';
      if (/拖动进度|播放控制|scrubb|playback/i.test(identity)) return '播放控制与进度条';
      if (/按压|悬停|磁吸|长按|弹射|飞行|press[- ]button|hover[- ]button|magnetic[- ]button/i.test(identity)) return '悬停与按压';
      if (/按钮|滑动确认|长按发布|点赞|\bbutton\b/i.test(identity)) return '基础按钮';
      if (/输入|上传|拖入|验证|签名|字数限制|floating[- ]label/i.test(identity)) return '输入与上传';
      return '选择与调节';
    default:
      return category;
  }
}

export function styleReferenceGroup(resource) {
  switch (componentCategory(resource)) {
    case '动画技法':
    case '镜头与剪辑':
      return '动画与镜头';
    case '摄影与画风':
      return '摄影与画风';
    default:
      return '';
  }
}

export const STYLE_REFERENCE_SUBCATEGORIES = {
  '动画与镜头': {
    '入场与显现': ['entrances-text'],
    '动画技法': ['motion-polish', 'techniques', 'text-shapes'],
    '动画转场': ['transitions-highlights'],
    '运镜': ['camera-movement'],
    '机位与拍法': ['angles-framing', 'shooting-style-time'],
    '剪辑与转场': ['transitions', 'transitions-editing'],
  },
  '摄影与画风': {
    '光线与布光': ['lighting'],
    '镜头与拍摄': ['lens-camera'],
    '色调与后期': ['tone-finish'],
    '绘画与版画': ['painting-printmaking'],
    '平面与插画': ['graphic'],
    '数字与材质': ['digital-3d-materials'],
  },
};

export function styleReferenceSubcategory(resource) {
  const groups = STYLE_REFERENCE_SUBCATEGORIES[styleReferenceGroup(resource)] || {};
  const type = resource.tags?.[2];
  return Object.entries(groups).find(([, tags]) => tags.includes(type))?.[0] || '其他';
}
