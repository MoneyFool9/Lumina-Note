# 外观插件接口

Lumina Note 支持用户创建和加载自定义主题。

## 主题文件位置

用户主题存放在 Vault 目录下的 `.lumina/themes/` 文件夹中：

```
你的笔记库/
├── .lumina/
│   └── themes/
│       ├── my-theme.json
│       └── another-theme.json
├── 笔记1.md
└── 笔记2.md
```

## 创建主题

### 方式一：使用主题编辑器（推荐）

1. 打开设置面板（左下角齿轮图标）
2. 点击「创建主题」按钮
3. 在可视化编辑器中调整颜色
4. 点击「保存到 Vault」

### 方式二：手动创建 JSON 文件

在 `.lumina/themes/` 目录下创建 `.json` 文件，格式如下：

```json
{
  "id": "my-custom-theme",
  "name": "我的主题",
  "description": "自定义的漂亮主题",
  "light": {
    "background": "45 10% 98%",
    "foreground": "40 10% 10%",
    "muted": "45 10% 94%",
    "mutedForeground": "40 5% 45%",
    "accent": "45 10% 93%",
    "accentForeground": "40 10% 15%",
    "primary": "215 25% 50%",
    "primaryForeground": "45 10% 98%",
    "border": "40 8% 88%",
    "heading": "215 35% 35%",
    "link": "215 40% 45%",
    "linkHover": "215 45% 40%",
    "code": "70 50% 35%",
    "codeBg": "45 10% 92%",
    "codeBlock": "45 10% 20%",
    "codeBlockBg": "45 10% 95%",
    "blockquote": "40 5% 40%",
    "blockquoteBorder": "215 20% 60%",
    "hr": "40 5% 80%",
    "tableBorder": "40 8% 85%",
    "tableHeaderBg": "45 10% 95%",
    "bold": "40 10% 15%",
    "italic": "40 10% 25%",
    "listMarker": "215 20% 50%",
    "highlight": "50 80% 85%",
    "tag": "245 25% 45%",
    "diffAddBg": "160 40% 92%",
    "diffAddText": "160 50% 30%",
    "diffRemoveBg": "350 40% 94%",
    "diffRemoveText": "350 50% 35%"
  },
  "dark": {
    "background": "40 5% 11%",
    "foreground": "45 8% 85%",
    "muted": "40 5% 15%",
    "mutedForeground": "40 5% 55%",
    "accent": "40 5% 18%",
    "accentForeground": "45 8% 92%",
    "primary": "215 20% 55%",
    "primaryForeground": "40 5% 12%",
    "border": "40 5% 22%",
    "heading": "215 25% 70%",
    "link": "215 30% 65%",
    "linkHover": "215 35% 70%",
    "code": "70 40% 70%",
    "codeBg": "40 7% 18%",
    "codeBlock": "45 8% 80%",
    "codeBlockBg": "40 5% 14%",
    "blockquote": "40 5% 65%",
    "blockquoteBorder": "215 15% 45%",
    "hr": "40 5% 28%",
    "tableBorder": "40 5% 25%",
    "tableHeaderBg": "40 5% 16%",
    "bold": "45 8% 95%",
    "italic": "45 8% 80%",
    "listMarker": "215 15% 60%",
    "highlight": "50 50% 25%",
    "tag": "245 20% 60%",
    "diffAddBg": "160 35% 20%",
    "diffAddText": "160 50% 70%",
    "diffRemoveBg": "350 35% 22%",
    "diffRemoveText": "350 50% 70%"
  }
}
```

## 颜色格式

所有颜色使用 HSL 格式，格式为 `"H S% L%"`：

- **H (Hue)**: 色相，0-360
- **S (Saturation)**: 饱和度，0-100%
- **L (Lightness)**: 亮度，0-100%

例如：
- `"215 25% 50%"` = 蓝灰色
- `"0 0% 100%"` = 纯白色
- `"0 0% 0%"` = 纯黑色

## 颜色属性说明

### 基础 UI 颜色

| 属性 | 说明 |
|------|------|
| `background` | 主背景色 |
| `foreground` | 主文字颜色 |
| `muted` | 次要背景色 |
| `mutedForeground` | 次要文字颜色 |
| `accent` | 强调背景色（悬浮等） |
| `accentForeground` | 强调文字颜色 |
| `primary` | 主色调（按钮、链接等） |
| `primaryForeground` | 主色调上的文字 |
| `border` | 边框颜色 |

### Markdown 渲染颜色

| 属性 | 说明 |
|------|------|
| `heading` | 标题颜色 |
| `link` | 链接颜色 |
| `linkHover` | 链接悬浮颜色 |
| `code` | 行内代码文字 |
| `codeBg` | 行内代码背景 |
| `codeBlock` | 代码块文字 |
| `codeBlockBg` | 代码块背景 |
| `blockquote` | 引用文字 |
| `blockquoteBorder` | 引用边框 |
| `bold` | 粗体颜色 |
| `italic` | 斜体颜色 |
| `listMarker` | 列表标记颜色 |
| `highlight` | 高亮背景 |
| `tag` | 标签颜色 |

### 表格与分割

| 属性 | 说明 |
|------|------|
| `hr` | 分割线颜色 |
| `tableBorder` | 表格边框 |
| `tableHeaderBg` | 表头背景 |

### Diff 对比颜色

| 属性 | 说明 |
|------|------|
| `diffAddBg` | 新增代码背景 |
| `diffAddText` | 新增代码文字 |
| `diffRemoveBg` | 删除代码背景 |
| `diffRemoveText` | 删除代码文字 |

## 导入/导出主题

- **导出**：在主题编辑器中点击「复制 JSON」或「下载」
- **导入**：点击「导入」按钮，粘贴 JSON 内容

## 分享主题

将导出的 JSON 文件分享给其他用户，他们可以：
1. 将文件放入自己的 `.lumina/themes/` 目录
2. 或使用主题编辑器的导入功能
