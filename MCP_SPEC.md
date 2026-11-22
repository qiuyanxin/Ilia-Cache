# Ilia Cache MCP 规范与边界

本文件定义 Ilia Cache 对外 MCP 的稳定契约。它描述允许返回什么，不代表项目已经实现了全部工具。

## 目标

MCP 用来让 Agent 查找组件、理解用途、取得提示词，并在许可允许时取得源码。它不是第三方组件站的镜像、下载代理或许可证绕过工具。

公开仓库保留完整组件目录。每个组件至少应能返回名称、说明、分类、预览、提示词、来源、作者、许可状态和可直接打开的组件页面。

## 权威数据

- 公开目录：`public/seed.json`
- 私人本地资料：`data/library.json`
- 公开来源策略：`sourcePolicy`
- 许可复核：`LICENSE_REVIEW.md`
- Agent 操作规则：`AGENTS.md`

公开 MCP 默认只能读取公开目录。私人 MCP 也必须遵守组件许可，不得因为本地保存了源码就自动获得再分发权。

## 建议工具

### `search_components`

按中文名、英文原名、分类、说明、来源或 ID 搜索。

输入：

```json
{
  "query": "弹性图片对比",
  "category": "图集与轮播",
  "source": "Bencho",
  "limit": 20
}
```

返回轻量列表，不返回源码文件。

### `get_component`

按 ID 返回单个组件的完整公开信息、提示词、预览和来源。

### `get_component_source`

仅当 `sourcePolicy` 为 `bundled-source` 时返回文件。其他策略必须返回来源页和拒绝原因，不得返回空壳源码冒充成功。

### `get_component_handoff`

返回给编码 Agent 的适配任务，包括目标技术栈、提示词、动效参数、依赖、来源和许可边界。只有 `bundled-source` 可以内嵌源码。

## 标准返回字段

```json
{
  "id": "component-id",
  "name": "中文名称",
  "originalName": "Original name",
  "description": "组件用途",
  "category": "卡片",
  "preview": {
    "type": "image | video | html | external",
    "url": "https://example.com/preview"
  },
  "prompt": "原始或整理后的提示词",
  "source": {
    "collectionSource": "LeiBox",
    "primarySourceAuthor": "Author",
    "primarySourceUrl": "https://example.com/original",
    "sourcePageUrl": "https://example.com/component",
    "sourcePageKind": "primary | collection",
    "sourceShort": "Source name",
    "license": "MIT | OFL-1.1 | unknown",
    "sourcePolicy": "bundled-source | official-source-only | source-link-only"
  },
  "usageCount": 0,
  "files": []
}
```

`sourcePageUrl` 必须指向具体组件、文档、仓库目录或原始帖子，不能只指向来源网站首页。无法确认第一来源时，保留已知收录页并将 `sourcePageKind` 标为 `collection`，不得编造作者链接。

## 三种源码策略

| 策略 | 网页展示 | MCP 返回 | 文件下载 |
| --- | --- | --- | --- |
| `bundled-source` | 效果、提示词、来源、源码 | 可返回文件与许可 | 允许 |
| `official-source-only` | 效果、提示词、官方组件页 | 不返回源码；引导到官方页 | 禁止 |
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
- 没有源码权限：返回 `source_restricted`、`sourcePolicy` 和 `sourcePageUrl`。
- 第一来源未确认：返回 `source_unverified`，不得猜测。
- 预览不可嵌入：返回原站链接，不做代理绕过。
- 许可未知：默认不返回源码。

## 发布检查

每次更新公开 MCP 数据前至少确认：

1. 所有公开组件都有 `primarySourceAuthor`、`sourceShort`、`sourcePageUrl` 和 `sourcePolicy`。
2. `sourcePageUrl` 不是空值，也不是只有域名的首页。
3. 非 `bundled-source` 记录没有进入公开源码包。
4. 返回源码时同时返回许可和来源声明。
5. 运行 `npm run check` 与 `npm test`。

仅供学习使用。第三方设计、代码与素材的权利归原权利人所有，使用须遵守其许可。
