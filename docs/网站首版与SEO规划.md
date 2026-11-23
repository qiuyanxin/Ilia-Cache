# Ilia Cache 网站首版与 SEO 规划

2026-11-22 · 英文优先 · 美国英语关键词为待量化市场

第一版做一个**免费、免登录、按场景找前端组件的公开站**。用户从关键词或场景进入，比较几种实现，打开预览，再去官方来源取代码，或把选择交给自己的 Agent。免费 MCP 先走本机安装。网站和本机版共用公开目录与组件 ID，本机版额外提供个人收藏、项目和笔记。

首发 **3 类页面**。首页就是组件目录，另提供组件详情和 MCP 接入页。来源用首页筛选器与卡片链接承接。上线验收以目录能否覆盖不同组件类型并跑通「搜索 → 预览 → 来源 → MCP」为准。图片轮播、多图画廊和前后对比是后续 SEO 候选。

## 1. 产品边界

| 项目 | 网站版 | GitHub 开源版 |
| --- | --- | --- |
| 用户任务 | 快速选型、对比不同来源、分享链接 | 自己维护资料库，做项目时重新找到收藏 |
| 启动方式 | 打开网页，匿名浏览 | 克隆后本机运行，也可自行部署和修改 |
| 数据 | 公开索引、公开专题、核过展示条件的预览和来源 | 同一版公开种子，外加用户本机收藏、附件、项目、学习笔记和导入导出 |
| 页面 | 独立、可分享、可被搜索引擎抓取的网页 URL | 保留现有 `/#/components`、`/#/projects` 等工作区路径和本机交互 |
| Agent | `/mcp` 提供免费安装指南。组件详情支持「Copy brief」复制本条需求、组件 ID、来源与许可信息 | 免费只读 stdio MCP 默认查公开条目。需要个人库时由用户启用指定本机范围。本机预览由本机站点提供 |
| 更新 | 发布经筛选的公共数据快照与独立专题 | 仓库版本附带公开快照；个人数据由用户自己保存和备份 |

开源版与网站版共用数据和标识，公开网站单独渲染。免费 MCP 第一版使用本机 stdio，`/mcp` 写清安装与启动条件。「Copy brief」复制文本，可独立使用。待公开详情页实际发布，再给 MCP 添加独立的公开详情链接字段，继续保留本机预览链接。当前本地 MCP 还未合入远端。对接时按最新 `MCP_SPEC.md` 补齐组件详情、预览和来源字段，统一限制源码的返回范围。网站首版以找组件为入口，相关网页案例和来源在能帮助选型时出现在卡片或详情里。字体、风格和学习功能继续由本机版提供，网站后续根据使用数据选择专题。

## 2. 公开资源能支撑什么

目录盘点基于已拉取的提交 `daae6f8`。GitHub 上更新的一笔 `20c2bc3` 只改了 `AGENTS.md`、`README.md` 和新增的 `MCP_SPEC.md`，公开资源快照没有变化。读取 Git 对象统计到 **850 个组件、87 份网站说明、218 个字体条目、59 个风格条目**。独立 MotionSites 目录有 281 条，当前主种子实际有 280 条网页参考记录，少了一条 `page-ms-ai-image-generator-ui`。组件中有 201 个音效，图库轮播类有 22 条。站点展示的计数按真正导入网站的条目计算。

组件源码策略有 `bundled-source` 240 条、`official-source-only` 454 条、`source-link-only` 156 条。240 个已随仓库提供的包位于 `public/component-packages/`。记录里的媒体 URL、可点击的原站演示、可在本站嵌入的预览需要分别核验。Motion Prompt #058 和 #087 有本地动画演示入口、提示词及 MIT 示例包，包内 Canvas 示例依赖 Motion Prompt kit。

| 目录题材 | 直接从现有目录选的例子 | 可用于回答的问题 |
| --- | --- | --- |
| 轮播 | `reactbits-carousel`、`reactbits-flex-carousel`、`reactbits-depth-carousel`、`leibox-ink-spread-carousel`、`motion-prompt-058` | 一次看一张还是露出下一张，横图还是竖图，移动端能否操作，代码去哪拿 |
| 多图画廊 | `reactbits-masonry`、`reactbits-accordion-gallery`、`reactbits-circular-gallery`、`leibox-image-accordion` | 多张图同时完整可见、展开一张或拖动浏览，各适用于什么素材 |
| 首屏案例 | `page-ms-outfit-carousel`、`page-ms-smoothie-slider` | 页面中的图片与文案如何分栏。条目有静态参考图，交互和比例要另行核对 |
| 前后对比 | `motion-prompt-087`、`4cbfeca4-e4db-402e-8b1f-a1aa0aa96012` | 两张图重叠后拖动分隔线，适合前后对照。后续画廊专题可引用这类组件 |
| 叠放 | `builtin-swipe-deck`、`leibox-card-swap`、`designbookmark-db-fan-cards` | 试叠放或甩动；Swipe deck 是网站卡片版，Fan cards 已收录至这版远端，记录提供原站锚点 |

资料归属按远端 `sourcePageUrl`、`sourcePageKind`、`primarySourceAuthor` 和 `sourcePolicy` 显示。确认为收录或实现演示的入口使用对应标签。已标记只能回官方获取源码的条目显示来源链接，已授权分发的包保留许可证和版权声明。公开站和 MCP 应对代码、媒体和提示词执行同样的公开规则。

**构建时生成网站专用公开快照。** 字段包括组件 ID、公开名称、场景、作者、来源、许可、预览类型及允许公开的编辑说明。即使字段已经出现在 Git 公开种子里，也只按名单导出。当前种子里有 `usage` 和 `favorite`，以及本机适配过程留下的字段。个人库 `data/`、本机包和附件始终由用户本机保管。公开网页和 MCP 的测试都检查输出字段。

资料来源 · [固定提交的 README](https://github.com/qiuyanxin/Ilia-Cache/blob/20c2bc3756a283d89ada3c4cb477420637fce473/README.md) · [最新 MCP 规范](https://github.com/qiuyanxin/Ilia-Cache/blob/20c2bc3756a283d89ada3c4cb477420637fce473/MCP_SPEC.md) · [源码策略构建脚本](https://github.com/qiuyanxin/Ilia-Cache/blob/daae6f8acc323b2432e708edf2c060bb924ff431/scripts/build-public-library.mjs) · [许可风险清单](https://github.com/qiuyanxin/Ilia-Cache/blob/daae6f8acc323b2432e708edf2c060bb924ff431/LICENSE_REVIEW.md)

## 3. 页面和 SEO 关键词

下表的主词用于制定页面任务。当前拿到的是英文公开搜索结果和结果类型，搜索工具未固定美国本地排名环境。搜索量、KD（关键词竞争难度）、精准排名和流量预测均缺同一口径的数据。优先级按当前素材质量、结果意图和页面能兑现的内容选定。

| 优先级 | URL | 主词与合并表达 | 页面交付 |
| --- | --- | --- | --- |
| 首发 | `/` | **`UI component gallery`**；`UI component directory`、`UI component examples`、`UI components with previews`、`UI component search` | 首页就是可搜索与筛选的跨来源组件目录，展示真实卡片和预览入口 |
| 首发 | `/components/<source>-<slug>` | 组件英文名 + 来源或交互名；对应的单一组件长尾 | 看具体效果、作者、许可和原站。可复制简报给 Agent |
| 后续专题候选 | `/collections/image-carousel` | `image carousel examples`；`image carousel UI examples`、`website image carousel examples`、`image slider examples` | 以图或视频先展示轮播差异，再给可复用的原组件。将 `hero image carousel examples` 作为首屏一节 |
| 后续专题候选 | `/collections/image-gallery` | `image gallery design examples`；`website image gallery examples`、`image gallery UI examples` | 比较同时展示多图的网格、瀑布流、手风琴和叠放。说明用户能第一眼看见几张 |
| 后置 | `/libraries` · 候选 | `UI component libraries`、`UI animation libraries`、`free UI component libraries` | 用户按整套组件库选型时再做。首发由首页的 `Source` 筛选和卡片来源链接承接 |
| 首发 | `/mcp` | `Ilia Cache MCP`；`MCP server for finding UI components` | 安装说明、支持客户端、免费使用方式、可复制问题和真实返回示例。通用 `UI component MCP` 词用于正文说明 |
| 待验证 | 画廊页内模块 | `image comparison slider examples`、`before and after slider component` | 现有两个明确例子，先展示差异与用途。能补齐多种对照方式和可验证演示后再决定独立 URL |
| 待验证 | 轮播页内模块 | `split-screen carousel`、`hero image carousel examples`、`half screen image carousel` | 英文已有 split-screen carousel 组件用法。半屏长尾的独立结果和量尚缺支撑，先做「首屏文字旁的图片区」选择指南 |
| 后置 | 现有专题内链与示例 | `website hero section examples`、`hero section design inspiration` | 搜索结果倾向完整首屏案例图库。等有一组可核的完整页面、足够独立的构图点评，再做一整页 |
| 后置验证 | — | `animated website backgrounds`、`text animation examples` | 目录有 Aurora、Silk、Split Text、Blur Text 等代表，等首批验证后再核搜索意图及选题 |
| 暂不匹配 | — | `free UI kit download`、`React image carousel`、`before after photo comparison online` | 需求分别是下载 UI 套件、直接安装特定框架组件、上传自己的图做处理。第一版页面文案按实际预览与原站访问能力写 |

### 搜索证据和竞争判断

- **组件目录与来源目录**。英文结果同时有按独立组件和按资源库组织的站点。独立组件页处理「找一个」，资源库页处理「找一套」。Component Hunt 已能跨库列作者、预览和来源。Ilia 首页用目录定位，先靠同尺寸案例对比和可直接交给 Agent 的选型信息验证获客。 [Component System Directory](https://componentsystem.directory/) · [Component Hunt](https://componenthunt.dev/) · [The Component Gallery](https://component.gallery/) · [21st 的组件库导航](https://www.21st.md/community/libraries) · [Resource.fyi 的免费组件库清单](https://resource.fyi/category/ui-libraries)
- **轮播**。搜 `image carousel examples` 可以看到可预览的社区作品和实际网站画廊，支持用可见示例承接。Ilia 的差异要落在一图多图、相邻图露出、选型理由和来源路径。 [Webflow 的 Image Carousel 案例](https://webflow.com/made-in-webflow/image-carousel) · [save.design 的 Carousel 案例](https://save.design/elements/carousel)
- **画廊和对比**。图库词有实际网站画廊结果；对比滑块词混有可安装组件和上传图片的工具。画廊用「多个不同画面怎么排」组织。两图变化用明确的组件示例标签。 [save.design 的图库示例](https://save.design/elements/gallery) · [Image Compare 组件](https://img-comparison-slider.sneas.io/) · [imgico 的双图工具](https://imgico.com/)
- **首屏与 MCP**。整套首屏示例的结果展示真实网站或完整区块；MCP 结果已有 UI 库的接入文档。半幅场景可作为目录搜索和 MCP 的验收样例。MCP 页面优先解决能否安装和怎么问。 [Agency Gallery 首屏示例](https://agencygallery.com/sections/type/hero) · [Columbia 的 Hero Image Carousel 文档](https://visualidentity.columbia.edu/content/hero-image-carousel) · [PaperThin 的 Split-Screen Carousel](https://www.paperthin.com/widget-gallery/split-screen-carousel.cfm) · [MUI MCP 文档](https://mui.com/material-ui/getting-started/mcp/) · [React Bits Pro MCP 文档](https://pro.reactbits.dev/docs/mcp)

## 4. 首发页面简报

### 首页 `/` · 主承接词 `UI component gallery`

- Title · **UI Component Gallery – Browse & Preview | Ilia Cache**
- H1 · **UI Component Gallery**
- Description · Browse a free directory of UI components from multiple sources. See previews, filter by category or source, and open the original component page.
- 首屏说明 · **Find buttons, carousels, and motion effects from different libraries. Preview them and open the original source.**
- 首屏顺序 · H1、一行说明、搜索框、分类与来源筛选、首批组件卡片。搜索框提示用 `Search components, interactions, or sources`，分类按目录实际内容写 `Buttons & Inputs`、`Navigation`、`Cards`、`Text Effects`、`Galleries & Carousels`。
- 次词由功能承接。`UI component directory` 用于页面简介，`UI component examples` 和 `UI components with previews` 由实际结果和预览承担；`UI component search` 对应首屏搜索框；`animated UI components` 用于动效筛选或精选。没有需要说明的内容时使用简短的 `Browse components`。MCP 在导航和卡片操作里链接 `/mcp`。
- 页面上的免费描述指浏览与使用导航；源码能否获取以单条的来源和许可证为准。卡片明确区分图、视频、可交互预览和原站入口。

| 英文词 | 搜索结果观察 | 首版放哪里 |
| --- | --- | --- |
| `UI component gallery` | 有逐个浏览和预览组件的图鉴，也有设计系统截图参考 | 首页主词，标题补 Browse & Preview，首句交代跨来源和原站链接 |
| `UI component directory` | 有整套设计系统和组件库目录，也有跨来源查单个条目的索引 | 首页说明用作次词 |
| `UI component examples`、`UI components with previews` | 前者混合实站截图和实践文章；后者有跨来源且提供预览的同形态网站 | 首页结果区和案例卡片 |
| `UI component search` | 已有提供组件或代码片段搜索的站点 | 搜索框与说明，作为同页词验证 |
| `animated UI components`、`interactive UI components` | 有面向特定技术栈的动画组件库和可交互图库 | 动效分类与预览说明 |
| `free UI components`、`React UI components` | 许多结果直接提供框架代码包、复制源码或 CLI 安装 | 来免费浏览可写进介绍；首页的关键词仍承诺目录与预览 |
| `UI component libraries` | 用户常在比较整套库与框架 | 首发融入来源筛选，后续有独立比对内容再评估新页 |

需求线索来自实际选型任务（按用途跨库找组件、预览再决定），同形态站点也提供按问题搜索、对比和回链。检索基于英文公开搜索结果与原始落地页。尝试访问 Google 美国英语自动补全失败，月搜索量、KD 和精准地区排名尚未取得。首页先按任务匹配选词，上线后用 Search Console 核对实际查询。 [按问题找并对比的 super-UI](https://github.com/blosmo/super-UI) · [跨库图鉴 AllComps](https://allcomps.vercel.app/)

首页主词取舍参照 [Quark UI Component Gallery](https://design.sik.limited/en/)、[Component Systems Directory](https://componentsystem.directory/)、[跨来源检索与预览的 bumpit](https://www.bump.it.com/components)、[The Component Gallery](https://component.gallery/)、[UI Discovery 的组件案例](https://uidiscovery.com/components)、[CodeKK 的组件搜索](https://www.codekk.dev/components)、[ApexUI 的动画安装库](https://apex-ui.in/) 和 [Uiverse 的免费源码库](https://uiverse.io/)。

### 组件详情 `/components/<source>-<slug>`

- Title 以组件的实际英文名、来源和用途命名，例如 `Carousel by React Bits – Preview & Source | Ilia Cache`。H1 用组件名称，首段说明用途及交互。
- 组件卡展示来源与预览入口。详情提供来源、作者、许可、实际预览类型和 `Copy brief`。优先把内容充分、能核实的详情纳入 sitemap。
- 公网首页是唯一的总目录页；兼容入口 `/components` 若需要可指向 `/`。本机版继续使用自己的组件库路由。

### MCP 接入 `/mcp`

- Title · **Ilia Cache MCP for UI Component Discovery**
- H1 · **Find UI components with Ilia Cache MCP**
- Description · Connect the free local Ilia Cache MCP to your coding agent. Search the catalog and return previews and original sources.
- H2 · `Install the free local MCP`、`Try a real search`、`Preview and source links`。写 Node、依赖安装、客户端配置和本机预览端口，返回示例用图库、导航或文字动效等真实条目。
- 文档先核 Codex 和协议测试；其他客户端按实测状态写。配置按钮复制命令，GitHub 链接提供完整项目。首页和组件详情里的 `Use with your agent` 进本页，MCP 结果链接到对应公开详情或可用的本机预览。

## 5. 后续专题候选

先用目录里的实际搜索、预览打开率和来源点击，判断是否值得新增专题。出现反复查询或可比较的案例时，再在轮播、画廊、前后对比等题材中择一。以下简报保留作候选。

### 轮播专题 `/collections/image-carousel`

- Title · **Image Carousel Examples for Websites | Ilia Cache**
- H1 · **Image carousel examples**
- Description · Compare image carousels for website heroes, product shots, and photo showcases. See demos and find the original components.
- 首屏已有三个不同类型的精选。普通横向轮播、会展开的多图轮播、以转场为亮点的轮播。让用户点击同一处看演示及来源。
- H2 · `Choose a carousel for your layout`、`Split-screen carousels for hero sections`、`Compare demos and controls`。比较同屏张数、横/竖图、移动端操作、是否支持手动切换、预览类型和源码途径。只填看过的数据，未知显示 `Unverified`。
- 半屏示例先解决「左侧文案右侧约半幅图片区」。把真实组件放到等宽容器中核对裁切、按钮位置和手机端手势。完整网页案例作为参考卡，标签写 `Page reference`。横向连到 Gallery，底部提供可复制的 Agent 问法。

### 画廊专题 `/collections/image-gallery`

- Title · **Image Gallery Design Examples for Websites | Ilia Cache**
- H1 · **Image gallery design examples**
- Description · Explore layouts for showing multiple images on a website, from masonry grids to accordion galleries and stacked cards.
- H2 · `Show multiple images at once`、`Use a gallery in a narrow space`、`Compare two images`。用 3 种主模式呈现同一任务的不同解法。模块对比第一眼可见张数、裁切和操作；双图滑块先用现有两个可核组件。
- 区分查看集合与切换单张，连回 Carousel。示例图片和首屏显示类型分别标注。

## 6. 开发与上线验收

1. **数据**。定公开字段、来源和源码策略映射以及稳定 ID，再产出网站索引。解决本地 MCP 与远端组件目录的合并，接入已许可公开包，覆盖只允许 `bundled-source` 转发源码、受限来源返回 `source_restricted` 和原站入口、未知来源保持待确认等测试。
2. **页面**。公开站用静态生成或服务端渲染，首屏标题、精选内容、正文和基本内链在 HTML 里。网站路径用真实 URL，现有本机 Hash 路由继续服务本机应用。每个可索引页有独立 Title、Description、H1、自指 canonical 和 sitemap 条目。搜索/筛选组合留给用户浏览，索引从有独特内容的入口发现。首页卡片直接链接组件详情，顶部链接 MCP 接入页。组件详情提供返回首页目录、查看同类别或来源的入口。 [Google URL 结构](https://developers.google.com/search/docs/crawling-indexing/url-structure) · [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
3. **验收**。用图库、菜单导航和文字动效三组实际查询验证目录。用户能搜索和筛选、打开组件详情、查看预览及原始来源，并在 Agent 里查到同一个 ID。桌面和手机都走一遍。媒体不可播放时显示已核图片或原站入口，相关详情返回实际 HTTP 状态。用 MCP 客户端查三条同一批公开记录比对 ID、来源、许可和链接，确认个人字段不会进入公开导出。
4. **回看**。提交 sitemap 后用 Search Console 观察查询→URL、国家、设备与收录状态。站内看有效搜索、打开预览、原站点击、Copy brief、MCP 配置复制。配置复制是安装意图，真实安装以用户跑通工具或可验证回执为准。前 2～4 周先看相关查询出现在哪一页；有持续相关曝光或真实使用，再扩下一个专题。量化先补首页代表词 `UI component directory`、`UI component gallery`、`UI component examples` 和 `UI component search` 的美国同口径搜索量和难度。

本次已完成目录核对、公开搜索结果抽样、页面和关键词映射。候选媒体的实际播放、站点域名和真实排名仍待核。方法采用用户本地保存的哥飞页面与内链原文，搜索规范按 Google 当前文档核对。 [哥飞内页和内链建设原文](https://new.web.cafe/tutorial/detail/1civEx3Bnca6XJm3Ufdj8V)
