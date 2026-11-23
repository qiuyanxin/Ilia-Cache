# Motion Prompt 独立动效预览

本目录为 Motion Prompt 的 216 个 Canvas 样例提供单独的预览。每张 WebP 缩略图由对应样例的实际代码绘制，点击组件详情时可播放原动效。作者为大滝昇平（Shohei Ohtaki），使用 MIT 许可。

上游代码锁定在 [`683ecca0548a1754ada141d10dc3a009d4c59bef`](https://github.com/showheyohtaki/motion-prompt/tree/683ecca0548a1754ada141d10dc3a009d4c59bef)。`runtime.js` 对应上游的 `assets/runtime.js`，其他包沿用上游 `packs/<name>/pack.js` 路径和文件内容。上游 [许可证](./LICENSE) 与 [第三方声明](./THIRD-PARTY-NOTICES.md) 随目录分发。

纳入的九个包只使用本地 Canvas 绘制。摄影效果包 `photo` 用手绘几何图形示意光照和镜头效果。第 193–216 号的 `artstyle` 包在目录显示作者公开的对应静态图，并保留原始来源链接。本地 Canvas 预览包不包含字体、社交媒体帖、照片或其他外部素材。 [画风包作者与图片许可声明](https://github.com/showheyohtaki/motion-prompt/blob/683ecca0548a1754ada141d10dc3a009d4c59bef/packs/artstyle/pack.js#L5-L11)

修改预览帧时，从开源仓库根目录运行 `python scripts/render-motion-prompt-posters.py`。该脚本需要可用的 Python Playwright 和 Chromium，也可通过 `ILIA_CHROMIUM_CHANNEL=chrome` 使用本机 Chrome。
