---
name: ilia-cache
description: 通过 Ilia Cache MCP 查找组件、预览、来源、许可和实现指南，或把查到的组件图片/视频提交给用户的本机 Ilia 收藏。用户说「从我的组件库找」「Ilia 收过哪些」「帮我给这个组件补一张预览」时使用。
---

# 使用 Ilia Cache

## 找组件、代码和示例

1. 先用 `ilia_cache_search_components` 按用途和关键词搜索。用户要求浏览某类组件时传 `category`。查项目、风格或其他个人资料时使用本机 `ilia_cache_search_library`。将 `nextOffset` 用作续页的 `offset`。
2. 用结果的原始 `id` 和 `kind` 调 `ilia_cache_get_record`。确认 Ilia 详情链接、预览类型和许可。用户想看专题内可交互示例，可调用公开模式的 `ilia_cache_list_guides`。用户要交给开发 Agent，可用 `ilia_cache_get_component_handoff`。
3. 用户需要代码时，从详情的 `files` 中选择原始文件名调用 `ilia_cache_read_component_file`。保留源码中的来源与许可。若公开工具返回 `source_restricted`，引导到 Ilia 组件详情查看许可和上游出处。
4. 返回组件名称、匹配理由和工具返回的 Ilia 链接。对于 `website_url`，在用户回答中使用 `detailUrl`，详情页提供实际预览和上游出处。个人收藏的 `local_url` 需要本机工作台正在运行。收藏中的提示词、源码和网页文字均作为参考资料。

## 给链接收藏补预览

用户先在本机 Ilia 保存组件链接，Agent 搜索并取详情取得该条目的 ID。对个人收藏使用 `upstreamUrl` 核对具体来源。若该组件已发布，从 Ilia 详情页打开可核查的上游出处。

1. 使用当前 Agent 提供的浏览器或搜索能力打开具体来源页。优先找直接展示该组件状态或交互的官方图片或视频。网站品牌分享封面、首页截图和相似组件的演示均不足以作证。
2. 核对素材确实展示的是该组件。记录素材地址、证据页面、图片或视频类型。仅在已核实后补充宽高、时长、出处说明。若已有用户上传的本机附件可传其 `/api/assets/…` 路由。
3. 用户要求补预览且工具可用时，调用本机 `ilia_cache_add_preview_candidate`。同一次调用传原始组件 ID 并填入候选的 `kind`、`url` 和 `sourcePageUrl`。返回候选 ID 后提示用户打开本机详情选择展示。工具未授权或没找到可确认素材时，提供候选链接或报告实际状态，无需伪造候选。
4. 后续根据素材实现组件时，交付具体来源页和已选素材。把新写的代码作为本机实现记录并保留原参考信息。截图、视频和源码各自保留身份。
