const text = value => typeof value === 'string' ? value.trim() : '';

export function portableComponentPrompt(record, { sourceUrl = '', category = '', files = [], reference } = {}) {
  const name = text(record?.name) || '这个组件';
  const details = [
    `- 组件：${name}`,
    category ? `- 分类：${category}` : '',
    sourceUrl ? `- 原始来源：${sourceUrl}` : '',
    record?.primarySourceAuthor ? `- 作者：${record.primarySourceAuthor}` : '',
    `- 许可：${text(record?.license) || '请在使用前核对原始来源'}`,
  ].filter(Boolean).join('\n');
  const command = text(record?.installCommand);
  const suppliedFiles = files.filter(file => text(file?.name) && typeof file?.content === 'string');
  const acquisition = command
    ? `使用下面的安装命令获取组件：\n\n${command}`
    : suppliedFiles.length
      ? `我已附上源码文件，请直接以这些文件为基础实现，不要根据截图重新猜代码：\n\n${suppliedFiles.map(file => `--- ${file.name} ---\n${file.content}`).join('\n\n')}`
      : sourceUrl
        ? '请从上面的原始来源获取官方提供的源码或安装方式；如果来源没有公开源码，请明确告诉我，不要根据截图伪造源码。'
        : '当前没有附带源码或安装命令。请先告诉我还缺少什么资料，不要根据截图伪造源码。';
  const original = text(record?.prompt);
  const referenceText = reference?.url ? `\n\n可用于核对外观和交互的参考${reference.kind === 'video' ? '视频' : '图片'}：${reference.url}${reference.sourcePageUrl ? `\n参考素材出处：${reference.sourcePageUrl}` : ''}` : '';
  return `请把「${name}」加入你正在处理的项目，并交付可以直接运行的结果。

组件资料
${details}

获取组件
${acquisition}
${original ? `\n组件原始说明或设计要求\n${original}\n` : ''}${referenceText}

实现要求
1. 先查看现有项目使用的框架、目录结构和样式方式，再决定组件放在哪里。
2. 安装缺少的依赖，并把组件真正接入一个页面或功能，不要只留下孤立的演示文件。
3. 保留原组件的交互方式和动效参数；视觉上适配现有项目的字体、颜色、圆角和间距。
4. 不确定许可、依赖或来源时先说明，不要擅自替换成外观相似但来源不明的实现。
5. 完成后运行项目已有的检查，告诉我改了哪些文件、在哪里能看到效果，以及之后如何再次使用这个组件。`;
}
