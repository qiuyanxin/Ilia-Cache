# Ilia Cache MCP

本机 MCP 可查个人组件库、项目与其他收藏，浏览器负责渲染交互预览。公开 MCP 可查同线上网站一致的公开组件、许可与预览。它使用独立入口，访问范围在启动时固定。

## 连接本机 MCP

需要 Node.js 22.16 或更新版本。在 Ilia Cache 仓库根目录运行。

```bash
npm ci --prefix mcp
codex mcp add ilia-cache -- "$(command -v node)" "$PWD/mcp/server.mjs"
```

其他 stdio 客户端也可以将 Node 的绝对路径作为命令，把仓库里的 `mcp/server.mjs` 绝对路径作为参数。运行 `npm start` 后，个人收藏的链接会打开本机详情，默认使用 `http://127.0.0.1:4317`。个人工作台使用其他端口时，在 MCP 环境设置 `ILIACACHE_PREVIEW_BASE_URL`。

已发布组件的链接在本机与公开模式都指向 Ilia 网站。在 MCP 环境设置 `ILIACACHE_PUBLIC_BASE_URL` 为已部署的 Ilia 网站地址。默认的 `http://127.0.0.1:4318` 是独立网站联调时使用的端口。用户可以在 Ilia 组件详情查看预览和具体来源。

私人资料默认读取同仓库的 `data/`。自定义数据目录可在 Web 与 MCP 同时设置 `ILIA_DATA_DIR`，已有 MCP 配置的 `ILIACACHE_DATA_DIR` 也能继续用。旧库中同 ID 的收藏优先使用已有记录，补齐新加入的公开种子。客户端连上个人 MCP 后可读取个人收藏和源码。

### 允许 Agent 提交预览候选

默认只有读取工具。要授权 Agent 提交候选，生成一个本机随机令牌，在 Web 进程和 MCP 客户端的服务环境同时设置同一个 `ILIA_MCP_WRITE_TOKEN`。重新启动 Web 和 MCP 后会注册 `ilia_cache_add_preview_candidate`。

```bash
export ILIA_MCP_WRITE_TOKEN="$(openssl rand -hex 24)"
npm start
```

将此值通过本地客户端环境传给 MCP，避免写入共享仓库或聊天。本机 Web 使用自定义端口时，让 MCP 的 `ILIACACHE_PREVIEW_BASE_URL` 指向对应地址。浏览器中的组件详情可以选中候选。重复提交同一素材会保留原候选 ID，可补充视频封面和已核实的尺寸。

请求的形状如下。实际调用时换成工具查到的原始 ID、选中的素材直达地址和能证明它对应此组件的网页。

```json
{
  "id": "saved-component-id",
  "candidate": {
    "kind": "video",
    "url": "https://example.com/assets/menu-preview.mp4",
    "poster": "https://example.com/assets/menu-preview.webp",
    "sourcePageUrl": "https://example.com/components/menu",
    "width": 1280,
    "height": 720,
    "label": "展开和收起演示"
  }
}
```

`poster`、尺寸和说明均为可选。本机 MCP 的「取得组件实现参考」工具会在 `referencePreview` 提供已选素材，包括原始出处和可用的封面、尺寸。已公开组件的 `detailUrl` 仍指向 Ilia 网站。

## 运行公开 MCP

公开模式从 Git 跟踪的 `public/seed.json` 生成与网站相同的目录。个人数据、上传附件、私有源码包及项目记录不会进入公开模式。无部署情况下可在命令行运行只读 stdio 模式。

```bash
ILIACACHE_SCOPE=public node mcp/server.mjs
```

为公开网站运行免费的 Streamable HTTP 端点，在 TLS 反向代理后将 `/mcp` 转给这个进程。部署时将 `ILIACACHE_PUBLIC_BASE_URL` 设置为实际网站地址，以便远程客户端打开组件链接。下面的保留域名仅用于示意。

```bash
ILIACACHE_PUBLIC_BASE_URL=https://ilia.example.com \
ILIACACHE_MCP_ORIGIN=https://mcp.ilia.example.com \
npm --prefix mcp run start:http
```

HTTP 默认监听 `127.0.0.1:4319`。可选的 `ILIACACHE_MCP_HOST` 和 `ILIACACHE_MCP_PORT` 控制监听地址。反向代理应保留受信任的 Host，并为外部客户端提供 HTTPS。站点和 MCP 服务应使用同一次发布的仓库版本。公开 HTTP 结构化响应基于固定 SDK 版本的 Streamable HTTP 兼容协议。 [MCP 传输规范](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)

## 工具

| 工具 | 用途 |
| --- | --- |
| `ilia_cache_search_components` | 按名称、用途、分类、来源或关键词搜索组件。 |
| `ilia_cache_search_library` | 搜索当前模式下可读记录和正文。本机另支持网站、风格、字体、项目等。 |
| `ilia_cache_get_record` | 使用搜索结果的 `kind` 和 `id` 读取详情、预览和文件名。 |
| `ilia_cache_read_component_file` | 使用详情里的准确文件名读取已登记内容。公开模式只交付许可允许分发的源码。 |
| `ilia_cache_list_guides` | 公开模式列出暗色开关、主题切换的说明页及实际示例链接。 |
| `ilia_cache_get_component_handoff` | 返回交给开发 Agent 的 Ilia 详情、源码许可、可用文件与可返回的提示词。 |
| `ilia_cache_add_preview_candidate` | 本机 MCP 启用写入后，可为已保存的组件提交具备来源证据的图片或视频。 |

所有成功的工具结果同时返回结构化字段和 JSON 文本。用 `nextOffset` 继续读取下页。已发布组件的 `detailUrl` 和 `preview.url` 是同一个 Ilia 详情页，预览类型为 `website_url`。如果发布条目的原文提示词带上游链接，请从详情页面查看。许可允许时，也可明确请求阅读组件的 `PROMPT.md`、`ORIGIN.json` 等原文件。个人收藏仍可通过 `upstreamUrl` 核对补素材所需的具体来源。

支持 MCP 资源的客户端可用 `ilia-cache://catalog` 查看作用域和计数，并按结果中的 `resourceUri` 读详情。附带的 [Ilia Cache Skill](../skills/ilia-cache/SKILL.md) 可安装到 Codex 项目的 `.agents/skills/`。 [工具规范](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) · [资源规范](https://modelcontextprotocol.io/specification/2025-11-25/server/resources) · [Agent Skills 规范](https://agentskills.io/specification)

```bash
npm --prefix mcp run check
npm --prefix mcp test
```
