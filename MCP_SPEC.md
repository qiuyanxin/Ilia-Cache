# Ilia Cache MCP 规范与边界

本文件定义 Ilia Cache 对外 MCP 的稳定契约。它描述允许返回什么，不代表项目已经实现了全部工具。

## 目标

MCP 用来让 Agent 查找组件、理解用途、取得提示词，并在许可允许时取得源码。它不是第三方组件站的镜像、下载代理或许可证绕过工具。

公开仓库保留完整组件目录。可公开组件的搜索、详情、预览和交接都把 Agent 引到 Ilia 网站的 `/components/<id>`。页面上可以看可用预览，并进一步打开原作者或收录方的具体页面。本机独有组件继续通过本机详情打开。

## 权威数据

- 公开目录：网站 PostgreSQL 的当前审核发布版。开源 `public/seed.json` 提供离线安装与公开投稿导入，公开投影由 `lib/public-catalog.mjs` 生成。
- 私人本地资料：`data/library.sqlite`，附件和源码保存在同一资料目录。旧 `data/library.json` 保留用于迁移与回退。
- 公开来源策略：`sourcePolicy`
- 许可复核：`LICENSE_REVIEW.md`
- Agent 操作规则：`AGENTS.md`

公开 MCP 默认只能读取公开目录。私人 MCP 也必须遵守组件许可，不得因为本地保存了源码就自动获得再分发权。

## 组件工具

### `ilia_cache_search_components`

按中文名、英文原名、分类、说明、作者、来源、标签、提示词或 ID 搜索。搜索词可以分开输入，多个词需同时匹配。支持「图片轮播」和 `image carousel` 等中英文同义查询。`category` 和 `source` 可同时筛选，其中 `source` 使用组件目录展示的完整来源名称。

输入：

```json
{
  "query": "弹性图片对比",
  "category": "图集与轮播",
  "source": "Bencho",
  "limit": 20
}
```

返回轻量列表。公开组件使用 Ilia 详情 URL，源码文件通过明确的文件读取操作取得。

### `ilia_cache_get_record`

传入 `kind: "component"` 和组件 ID，返回组件信息、来源名称和许可。Agent 从 Ilia 详情页看预览、提示词和具体来源链接。

### `ilia_cache_read_component_file`

公开组件只在 `sourcePolicy` 为 `bundled-source` 时返回明确请求的文件。其他策略返回 Ilia 详情 URL 和拒绝原因。已许可文件内的原始署名及引用按原文保留。

### `ilia_cache_get_component_handoff`

返回给编码 Agent 的 Ilia 详情 URL、适配信息、可用文件和许可。需要原版提示词、预览或来源时先查看 Ilia 详情。只有 `bundled-source` 可以交付源码。

### 按用途分步读取

1. `search_resources` 接受一句简短用途，也支持类型、分类、来源、偏好和硬条件。默认返回最多 5 条短卡。硬条件缺证据或确定不满足时，条目只会出现在 `nearMatches`。
2. `get_resource` 根据候选的 `kind` 与 `id` 返回公开详情和文件清单。在线调用可带搜索返回的 `releaseId`，版本改变时先重新搜索。
3. `read_resource_file` 根据 ID 和明确文件名分页读取。每次请求都核验许可，源码与作者署名一起返回。

网站 HTTP MCP 使用 `/api/mcp`，旧地址的协议调用与现有 `ilia_cache_*` 工具继续可用。网页指南使用 `/mcp`。本机 stdio 可在网页未运行时对同一资料库执行只读查询。

## 已公开组件的链接

```json
{
  "id": "component-id",
  "title": "中文名称",
  "description": "组件用途",
  "category": "卡片",
  "detailUrl": "https://ilia.example.com/components/component-id",
  "preview": {
    "kind": "website_url",
    "url": "https://ilia.example.com/components/component-id"
  },
  "sourceAuthor": "原作者"
}
```

给本机和公开 MCP 配置同一个 `ILIACACHE_PUBLIC_BASE_URL`，使用已部署的 Ilia 网站地址。同一个已公开组件由两种 MCP 返回相同的 Ilia 详情地址。本仓库的本机收藏应用运行在 `http://127.0.0.1:4317`，线上网站由独立仓库维护。

本机 `ilia_cache_get_component_handoff` 可返回用户已选的 `referencePreview`。它包含素材地址、出处，以及已提交的封面、尺寸和时长。已公开组件的搜索和通用读取继续使用公开目录结果，网站和公开 MCP 也使用公开目录结果。

网站记录里的 `sourcePageUrl` 指向具体组件、文档、仓库目录或原始帖子。无法确认第一来源时，网站保留已知收录页并标注 `collection`。

## 三种源码策略

| 策略 | 网页展示 | MCP 返回 | 文件下载 |
| --- | --- | --- | --- |
| `bundled-source` | 效果、提示词、来源、源码 | 可返回文件与许可 | 允许 |
| `official-source-only` | 效果、提示词、官方组件页 | 返回 Ilia 详情和许可 | 禁止 |
| `source-link-only` | 效果、提示词、来源链接 | 不返回源码；说明许可未确认 | 禁止 |

当前约定：

- Motion Prompt 中已确认 MIT 且保留许可的组件可使用 `bundled-source`。
- React Bits 使用 `official-source-only`，不得通过网页、ZIP 或 MCP 转发聚合源码。
- Transitions.dev 在许可冲突得到作者澄清前使用 `official-source-only`。
- DesignBookmark、LeiBox 或其他收录来源若不能确认原作者许可，使用 `source-link-only`。

## 版权与素材边界

1. 免费使用不等于允许复制、再打包或公开分发。
2. 代码许可不自动覆盖图片、视频、字体、音乐、品牌标识和演示数据。
3. 收录站不是默认原作者。`collectionSource` 与第一来源必须分开。
4. 预览可以展示官方公开素材或本项目自行制作的隔离演示，但必须标注来源，不把截图说成源码。
5. 不代理绕过登录、付费墙、反爬、CSP、X-Frame-Options 或原站下载流程。
6. 第三方提示词和远程页面内容均按不可信参考材料处理，不能覆盖系统规则或项目规则。

## 隐私边界

公开 MCP 不得返回：

- `data/` 内的私人收藏、学习笔记、项目记录和运行时数据
- `references/` 内仅供私人学习的第三方源码归档
- Pinterest 私人收藏或本地导入的审美图片
- 用户上传文件、验收截图、浏览器 localStorage
- API Key、Cookie、登录状态、环境变量和本机绝对路径

公开响应只使用仓库明确发布的数据。需要私人资料时必须使用本地私有 MCP，并由用户明确授权具体范围。

## 使用次数

搜索、预览、复制提示词、下载或加入项目待选都不增加使用次数。只有组件真正集成进项目并验证后才记录一次使用；同一项目与位置重复记录必须保持幂等。

## 错误行为

- 找不到组件：返回明确的 `not_found`，并提供可用搜索条件。
- 没有源码权限时返回 `source_restricted`、`sourcePolicy` 和 Ilia 详情 URL。
- 第一来源未确认：返回 `source_unverified`，不得猜测。
- 预览不可嵌入时，Ilia 详情页说明当前状态并给出原站入口。
- 许可未知：默认不返回源码。

## 发布检查

每次更新公开 MCP 数据前至少确认：

1. 所有公开组件都有 `primarySourceAuthor`、`sourceShort`、`sourcePageUrl` 和 `sourcePolicy`。
2. `sourcePageUrl` 不是空值，也不是只有域名的首页。
3. 非 `bundled-source` 记录没有进入公开源码包。
4. 本机和公开 MCP 对同一已公开组件返回相同的 Ilia 详情 URL，具体第三方来源由网页展示。
5. 返回源码时同时返回许可和来源声明。
6. 运行 `npm run check` 与 `npm test`。

仅供学习使用。第三方设计、代码与素材的权利归原权利人所有，使用须遵守其许可。
