# 参与 Ilia Cache

Ilia Cache 的开源仓库维护本机设计资料库、MCP 和公开目录的来源规则。欢迎改进录入、预览、搜索、数据兼容和使用文档。

## 从干净检出开始

需要 Node.js 22 或更新版本。验证使用仓库自带的公开目录和临时资料库。

```sh
npm ci
npm --prefix mcp ci
npm run verify
npm start
```

打开 [本机工作台](http://127.0.0.1:4317/)。手动测试迁移或删除流程时，把 `ILIA_DATA_DIR` 指向单独的测试目录。

`npm run check` 自动检查仓库根目录、`lib/`、`public/`、`public/motion-prompt-preview/`、`scripts/`、`test/` 中直接存放的 JavaScript 文件。`npm run verify` 还会运行本机工作台和 MCP 的测试。

`npm run build:previews:public` 用仓库内的原始示例走一遍 JSX/TSX 构建流程。普通检出直接运行 `npm run build:previews` 也会使用此流程。维护者已经准备了历史预览清单时，该命令保留原来的归档构建行为。显式归档命令为 `npm run build:previews:archive`。

## 找到要改的代码

| 改动 | 入口 |
| --- | --- |
| 组件分类、来源和源码权限 | `public/component-taxonomy.mjs` |
| 首页区块 | `public/home-page-view.mjs` 负责标题、动效装饰和入口卡片。宿主提供统计与跳转地址，本机页在 `public/home-page.mjs` 接入 |
| 组件录入与预览 | `component-records.mjs`、`preview-builder.mjs`、`public/local-component-editor.mjs` |
| 本机参考图、视频和封面 | `component-records.mjs` 保存候选，`public/reference-media-model.mjs` 供浏览器、服务端和 MCP 共用附件格式及尺寸换算 |
| 共享组件浏览和详情 | `public/component-workspace-ui.mjs`、`public/component-media.mjs` |
| 详情源码包的加载和缓存 | `public/component-package-cache.mjs` |
| 源码页签与公开下载 | `public/component-source-panel.mjs` 共用文件清单、选中文件、代码阅读区和复制操作。切换文件从新文件开头阅读。网站在源码包加载和重试期间提供公开 JSON 下载，本机通过组件管理下载 ZIP |
| 卡片悬停播放与媒体加载失败 | `public/component-card.mjs` 生成按需加载的封面，`public/component-media.mjs` 在悬停时挂载单个播放器，离开或切换详情时移除。视频失败时卡片保留封面 |
| 本机旧收藏的媒体 | `public/local-component-actions.mjs` 把旧 `media[]` 和静态封面转换为图片或视频数据，共用模块负责渲染。目录悬停才加载视频，项目夹和待选区展示封面，详情可手动播放 |
| 详情预览的尺寸与加载状态 | `public/component-detail-preview.mjs`。图片和视频有固定的展示区，Motion Prompt 画出首帧后切走封面，审核过的原站交互预览由用户点击加载 |
| Motion Prompt 播放器交互 | `public/component-detail-preview.mjs` 和 `public/motion-prompt-preview/player.js`。详情只处理当前播放器的消息，记住手动暂停的位置。播放器在五秒内未就绪时保留海报并显示来源提示，迟到首帧可以恢复预览 |
| 视频的播放与暂停 | `public/component-media.mjs`。卡片离开视口时释放播放器。同一详情中的视频按地址记住位置、播放和静音状态。页面退到后台时暂停，关闭详情后清空播放记录 |
| 本机保存、组件操作和网站收藏 | `public/extensions.js`、`public/local-component-actions.mjs`、`public/local-site-collections.mjs` |
| 本机保存的音效试听 | `public/local-component-audio.mjs`。公开目录的音效详情使用已审核的来源链接 |
| 目录交互与响应式分列 | `public/component-directory.mjs` 管理结果，`public/component-lane-layout.mjs` 按首屏同一套 CSS 断点换列。换列时保留可见的焦点或卡片 |
| 网站首屏与交互目录的筛选项 | `public/component-directory-controls.mjs` 共用分类、来源选项。无脚本时通过原生表单应用筛选。切换或恢复筛选时，把选项移进滑动条的可见区域，接管时保留焦点和横向位置 |
| 目录结果数量与无结果提示 | `public/component-directory-controls.mjs` 共用结果状态和清除筛选入口。有匹配时入口显示在结果数量旁，无结果时显示在提示下方，网站接管时保留焦点 |
| 目录和服务端首屏共用的分列规则 | `public/component-lanes.mjs`。网站未筛选时显示每种宽度下排在各列开头的 24 张卡片 |
| 公开组件卡片的预览和文字区域尺寸 | `public/component-workspace.css`。相同组件在两版预留相同的空间，预览内容按原比例显示 |
| 网站首屏与交互目录的卡片模板 | `public/component-card.mjs`。服务端使用已审核预览和普通链接，交互目录接入播放与详情按钮 |
| 组件筛选与排序 | `public/component-search.mjs`。浏览器和网站服务端共用选择逻辑，MCP 共用检索字段与评分 |
| 目录筛选链接和恢复 | `public/component-directory-url.mjs`、`public/component-navigation.mjs`。网站的公开筛选使用 URL，本机使用浏览器历史状态。两版在输入法确认后更新结果，恢复输入值时由 `public/input-clear.mjs` 通知控件更新显示 |
| 组件详情地址、页签与浏览器历史 | `public/component-navigation.mjs`、`public/component-directory-url.mjs`。两版用 `tab` 记录页签，切换沿用当前历史记录。关闭详情回到原筛选的目录。网站目录尚在加载时，先聚焦首屏的原卡片或搜索框，再沿用这处焦点 |
| 公开组件路径与页面标题 | `public/component-document.mjs`。开源版、网站及公开目录生成器共用路径规则，网站首屏和站内导航共用标题与说明 |
| 详情标签的键盘操作和参考素材 | `public/component-detail-tabs.mjs`、`public/component-workspace.mjs`。两版使用同一份来源和素材布局，本机可管理候选 |
| 侧栏、设置和复制反馈 | `public/workspace-chrome.mjs` 负责组合工作台控制。本机项目和备份操作在 `public/interface.mjs` 接入 |
| 剪贴板与手动复制 | `public/workspace-copy.mjs` 供两版复制组件、提示词和源码。剪贴板写入失败时，弹窗提供已选中的只读文本，关闭后回到原按钮 |
| 快捷栏和搜索 | `public/workspace-dock.mjs` 管理按钮、高亮、弹簧以及页面选中状态，`public/workspace-search.mjs` 管理搜索框的展开、焦点和宽度 |
| 网站共享浏览器文件 | `lib/workspace-browser-assets.json`。新增两版都要加载的文件时更新此清单，开源测试会核对共享入口的依赖是否列齐 |
| 网站资源版本 | 网站同步脚本把样式、浏览器模块、拉绳和 Motion Prompt 预览放在按内容计算版本的目录。目录、详情和指南引用同一发布路径，网站保留紧邻的上一版供旧页面加载 |
| 窄屏快捷栏和拉绳空间 | `public/interface.css`。两版在 480 像素及以下使用等宽图标按钮，本机的项目待选按钮移到侧栏。快捷栏高亮随页面更新，进入搜索或打开收集弹窗时临时切换 |
| 本机侧栏条目和计数 | `public/app.js`。条目创建一次，切换视图时更新选中状态和计数。共享侧栏读取 `aria-current` 更新高亮动效 |
| 网站脚本加载前的侧栏与快捷栏 | `lib/workspace-shell.mjs`。目录与专题填入真实站内链接，浏览器保留原链接并启用动效 |
| 两版共用的页面外壳 | `public/index.html`、`lib/workspace-shell.mjs`。网站目录填入只读入口及服务端表单和结果，网站专题页复用主题脚本、侧栏和顶栏标记 |
| 详情首屏与交互弹窗 | `public/component-detail-chrome.mjs` 共用标题、说明和来源；`public/component-workspace.css` 共用面板尺寸。网站服务端提供返回链接和已审核预览 |
| 提示词页签 | `public/component-detail-chrome.mjs` 共用文本框和操作区，网站启动交互时保留选区和阅读位置。本机保存与学习操作由 `public/local-component-actions.mjs` 接入 |
| 首屏主题与拉绳换肤 | `public/index.html` 的共享首屏脚本从本机读取主题，在目录加载前就能随其他标签页切换黑白。交互预览由 `public/workspace-theme.mjs` 和 `public/motion/pull-cord.html` 接收页面主题 |
| 本机保存与索引 | `library-store.mjs`、`library-index.mjs` |
| MCP 搜索、详情和文件读取 | `mcp/catalog.mjs`、`mcp/tools.mjs` |
| 网站和 MCP 使用的公开目录规则 | `lib/public-catalog.mjs`、`MCP_SPEC.md` |
| 网站直达详情的初始数据 | `public/component-public-record.mjs`。首屏仅带当前公开组件，后台目录使用同一个转换函数生成。网站同步时为目录和源码包记录发布版本，交互加载时核对版本再更新界面 |

组件目录、卡片及详情的现有交互是页面变更的回归基线。目录刷新时重建搜索索引，连续输入复用已规范化的检索字段。筛选结果未变时保留原卡片节点。改动界面时，说明受影响的页面、操作、手机宽度与减少动态效果设置。涉及数据的改动请验证旧格式读取，并说明迁移后用户要看到什么。

两版都通过 `installComponentWorkspace` 挂载目录和详情。只读宿主提供组件路由与公开源码包读取函数。本机入口额外接入收藏、编辑和同步。新增本机写入动作时，请放入本机模块。开源版测试会解析共享浏览器入口的导入链，检查它有没有引入本机代码。

## 对照两版组件库

有网站工作区的维护者可以用 Chrome 和 Python Playwright 比较两版。使用临时 `ILIA_DATA_DIR` 运行本机工作台，确认网站实例用同一版本的公开目录，然后执行：

```sh
python scripts/compare-component-library.py --oss http://127.0.0.1:4317 --website http://127.0.0.1:4320
```

脚本会比对目录在 1440、900、390 和 320 像素下每张公开卡片的位置、高度和预览区域，并检查浅色主题、长说明和视频加载失败时的尺寸。它也会检查侧栏和预览动效、详情导航、手机参考素材布局，以及拉绳换肤、键盘、跨标签页主题和减少动态效果设置。网站关闭 JavaScript 后，脚本会提交目录筛选，核对结果顺序、详情链接和返回路径，并检查专题页可读。可选 `--screenshots` 会将两版截图写入指定目录。

私人收藏、上传附件和带分发限制的第三方源码保存在本机。公开目录的新增条目请带可核对的具体来源、作者和许可。结构、来源政策或公开字段发生变化时，请更新相应测试和 `MCP_SPEC.md`。

## 生成待审核的公开目录

将逐项审核过的记录写成含 `resources` 的 JSON。获准公开源码的包放在 JSON 旁的 `packages/` 目录，每个文件以组件 ID 命名。

```sh
node scripts/build-public-library.mjs --reviewed-input /path/to/reviewed.json --output /path/to/new-release
```

脚本先检查所有声明公开的包和来源许可，再一次生成新目录，里面有 `seed.json` 和对应的 `component-packages/`。省略 `--output` 会生成到脚本打印的临时路径。在开源仓库检视这两个产物的差异后，通过正常提交更新公开目录。网站从指定开源检出同步，公开 MCP 使用同一套源码包校验。

## 修复派生索引

本机资料的主文件是 `data/library.json`。如果组件索引缺失或损坏，关闭本机服务后运行 `npm run rebuild:index`。这条命令只重建组件索引、清单和派生文件。迁移或更换电脑前备份整个 `data/`。
