# Lumina Note 功能清单

> 最后更新：2025-12-09

---

## ✅ 已实现功能

### 1. 核心编辑

| 功能 | 文件位置 | 说明 |
|------|----------|------|
| Markdown 编辑器 | `src/editor/CodeMirrorEditor.tsx` | 基于 CodeMirror 6 |
| 实时预览模式 | `src/editor/ReadingView.tsx` | 阅读/实时/源码三种模式 |
| 语法高亮 | CodeMirror + lowlight | 支持多种编程语言 |
| 数学公式 | `src/lib/markdown.ts` | KaTeX 渲染，支持行内 `$...$` 和块级 `$$...$$` |
| Mermaid 图表 | `CodeMirrorEditor.tsx` + `ReadingView.tsx` | 流程图、时序图等实时预览 |
| WikiLink | `src/lib/markdown.ts` | `[[笔记名]]` 双向链接 |
| 标签系统 | `src/lib/markdown.ts` | `#标签` 自动识别 |
| Callout 块 | `src/lib/markdown.ts` | `> [!note]` 等样式 |
| 代码块 | CodeMirror Widget | 语法高亮 + 复制按钮 |
| 表格渲染 | marked 扩展 | Markdown 表格支持 |
| 自动保存 | `src/editor/Editor.tsx` | 500ms 防抖自动保存 |
| 图片粘贴 | `src/editor/CodeMirrorEditor.tsx` | 剪贴板图片自动保存到 assets |
| Markdown 大纲 | `src/components/layout/RightPanel.tsx` | 右侧面板 OutlineView |

### 2. 文件管理

| 功能 | 文件位置 | 说明 |
|------|----------|------|
| 文件树 | `src/components/layout/Sidebar.tsx` | 树形目录结构 |
| 多标签页 | `src/components/layout/TabBar.tsx` | 同时打开多个文件 |
| 文件搜索 | `src/components/search/CommandPalette.tsx` | Ctrl+P 快速打开 |
| 创建/删除/重命名 | `src/stores/useFileStore.ts` | 完整文件操作 |
| 拖拽排序 | Sidebar | 文件夹/文件拖拽 |
| Vault 管理 | `useFileStore.ts` | 选择和切换 Vault |

### 3. 搜索功能

| 功能 | 文件位置 | 说明 |
|------|----------|------|
| 全文搜索 | `src/components/search/GlobalSearch.tsx` | Ctrl+Shift+F |
| 搜索替换 | GlobalSearch | 支持批量替换 |
| 正则搜索 | GlobalSearch | 可选正则表达式 |
| 大小写敏感 | GlobalSearch | 可选开关 |
| 命令面板 | `src/components/search/CommandPalette.tsx` | Ctrl+P |
| 笔记索引 | `src/stores/useNoteIndexStore.ts` | 全库索引 |

### 4. 知识图谱

| 功能 | 文件位置 | 说明 |
|------|----------|------|
| 全局图谱 | `src/components/effects/KnowledgeGraph.tsx` | 所有笔记关系可视化 |
| 局部图谱 | `src/components/effects/LocalGraph.tsx` | 当前笔记的关联图 |
| 物理引擎 | Canvas + 自定义物理 | 节点弹性布局 |
| 节点交互 | KnowledgeGraph | 点击跳转、拖拽、缩放 |
| 孤立节点视图 | Tab 支持 | 单独查看节点关系 |

### 5. AI 助手

| 功能 | 文件位置 | 说明 |
|------|----------|------|
| 聊天对话 | `src/components/chat/ChatPanel.tsx` | 右侧面板 |
| Agent 系统 | `src/agent/` | 自动工具调用 |
| 流式响应 | `src/components/chat/StreamingMessage.tsx` | 打字机效果 |
| 多模型支持 | `src/stores/useAIStore.ts` | OpenAI/自定义 API |
| Diff 预览 | `src/components/effects/DiffView.tsx` | AI 修改前确认 |
| 语音输入 | `src/components/ai/VoiceInputBall.tsx` | 语音转文字 |
| AI 设置 | `src/components/ai/AISettingsModal.tsx` | API Key、模型配置 |

#### AI Agent 工具

| 工具 | 文件 | 功能 |
|------|------|------|
| CreateNoteTool | `executors/` | 创建笔记 |
| EditNoteTool | `executors/` | 编辑笔记（带 Diff） |
| DeleteNoteTool | `executors/` | 删除笔记 |
| ReadNoteTool | `executors/` | 读取笔记内容 |
| SearchNotesTool | `executors/` | 搜索笔记 |
| SemanticSearchTool | `executors/` | 语义搜索 |
| DeepSearchTool | `executors/` | 深度搜索 |
| GrepSearchTool | `executors/` | 正则搜索 |
| GetBacklinksTool | `executors/` | 获取反向链接 |
| ListNotesTool | `executors/` | 列出笔记 |
| CreateFolderTool | `executors/` | 创建文件夹 |
| MoveFileTool | `executors/` | 移动文件 |
| RenameFileTool | `executors/` | 重命名文件 |
| AddDatabaseRowTool | `executors/` | 添加数据库行 |
| QueryDatabaseTool | `executors/` | 查询数据库 |
| GenerateFlashcardsTool | `executors/` | 生成闪卡 |

### 6. PDF 功能

| 功能 | 文件位置 | 说明 |
|------|----------|------|
| PDF 查看器 | `src/components/pdf/PDFViewer.tsx` | 基于 pdfjs-dist |
| PDF 大纲 | `src/components/pdf/PDFOutline.tsx` | 目录导航 |
| PDF 搜索 | `src/components/pdf/PDFSearch.tsx` | 文档内搜索 |
| PDF 标注 | `src/components/pdf/AnnotationPopover.tsx` | 高亮、笔记 |
| 标注存储 | `src/stores/usePDFAnnotationStore.ts` | 持久化标注 |
| 缩略图 | `src/components/pdf/PDFThumbnails.tsx` | 页面预览 |
| PDF 导出 | `src/lib/exportPdf.ts` | 笔记导出为 PDF |

### 7. 数据库（类 Notion）

| 功能 | 文件位置 | 说明 |
|------|----------|------|
| 数据库视图 | `src/components/database/DatabaseView.tsx` | 表格视图 |
| 多种字段类型 | `src/components/database/cells/` | 文本、数字、日期、选择、多选、URL |
| 创建数据库 | `src/components/database/CreateDatabaseDialog.tsx` | 模板选择 |
| 列操作 | `src/components/database/ColumnHeader.tsx` | 添加、删除、排序 |
| 筛选排序 | `src/components/database/DatabaseToolbar.tsx` | 数据筛选 |
| 数据库存储 | `src/stores/useDatabaseStore.ts` | JSON 持久化 |

### 8. 闪卡系统

| 功能 | 文件位置 | 说明 |
|------|----------|------|
| 闪卡视图 | `src/components/flashcard/FlashcardView.tsx` | 卡片展示 |
| 闪卡复习 | `src/components/flashcard/FlashcardReview.tsx` | 间隔重复 |
| SM-2 算法 | `src/lib/sm2.ts` | 记忆曲线算法 |
| AI 生成闪卡 | Agent Tool | 自动提取知识点 |
| 闪卡存储 | `src/stores/useFlashcardStore.ts` | 进度持久化 |

### 9. 视频笔记

| 功能 | 文件位置 | 说明 |
|------|----------|------|
| 视频播放 | `src/components/video/VideoNoteView.tsx` | 内嵌播放器 |
| 时间戳笔记 | VideoNoteView | 关联视频时间点 |
| 语音笔记 | `src/hooks/useVoiceNote.ts` | 语音转文字笔记 |

### 10. 内置浏览器

| 功能 | 文件位置 | 说明 |
|------|----------|------|
| 浏览器视图 | `src/components/browser/BrowserView.tsx` | WebView 容器 |
| 地址栏 | `src/components/browser/AddressBar.tsx` | URL 导航 |
| 浏览器管理 | `src/stores/useBrowserStore.ts` | 多标签管理 |
| CEF 池 | `src/hooks/useCefBrowserPool.ts` | 浏览器实例池 |

### 11. 界面与主题

| 功能 | 文件位置 | 说明 |
|------|----------|------|
| 设置面板 | `src/components/layout/SettingsModal.tsx` | 偏好设置 |
| 主题系统 | `src/lib/themes.ts` | 多套内置主题 |
| 自定义主题 | `src/components/ai/ThemeEditor.tsx` | AI 生成主题 |
| 深色/浅色 | `useUIStore.ts` | 一键切换 |
| 液态玻璃效果 | `src/components/effects/LiquidGlassEffect.tsx` | iOS 18 风格 |
| 分栏编辑 | `src/components/layout/SplitEditor.tsx` | 左右分屏 |
| 可调整面板 | `src/components/toolbar/ResizeHandle.tsx` | 拖拽调整宽度 |
| 右侧面板 | `src/components/layout/RightPanel.tsx` | AI/大纲/反链 |
| 标题栏 | `src/components/layout/TitleBar.tsx` | 自定义窗口控制 |
| Ribbon | `src/components/layout/Ribbon.tsx` | 左侧图标栏 |

### 12. 其他功能

| 功能 | 文件位置 | 说明 |
|------|----------|------|
| 快捷键 | `App.tsx` | Ctrl+S/N/P 等 |
| 调试日志 | `src/lib/debugLogger.ts` | 开发模式日志 |
| Frontmatter | `src/lib/frontmatter.ts` | YAML 元数据解析 |
| RAG 存储 | `src/stores/useRAGStore.ts` | 向量检索 |
| 加密工具 | `src/lib/crypto.ts` | 数据加密 |

---

## ❌ 未实现 / 待完善功能

### 高优先级

| 功能 | 说明 | 建议方案 |
|------|------|----------|
| **历史版本** | 无法恢复误删内容 | 本地 .history 文件夹 |
| **表格编辑器** | 手写 Markdown 表格麻烦 | 可视化表格编辑组件 |

### 中优先级

| 功能 | 说明 | 建议方案 |
|------|------|----------|
| **笔记模板** | 快速创建常用格式 | 模板文件夹 + 插入 |
| **导出格式** | 仅支持 PDF | 添加 HTML/Word 导出 |
| **标签管理** | 无标签聚合视图 | 标签面板 + 过滤 |
| **日历视图** | 按日期查看笔记 | 日记/日程功能 |

### 低优先级

| 功能 | 说明 | 建议方案 |
|------|------|----------|
| 云同步 | 需要后端服务 | WebDAV / S3 / 自建 |
| 插件系统 | 扩展性 | 插件 API + 加载器 |
| 移动端 | 仅桌面端 | Tauri Mobile / PWA |
| 多窗口 | 单窗口限制 | Tauri 多窗口 API |
| 代码执行 | 类 Jupyter | Python/JS 运行时集成 |
| 协作编辑 | 多人同时编辑 | CRDT + WebSocket |
| 发布功能 | 笔记分享 | 静态站点生成 |

---

## 📊 功能统计

| 类别 | 已实现 | 待实现 |
|------|--------|--------|
| 核心编辑 | 13 | 1 |
| 文件管理 | 6 | 0 |
| 搜索功能 | 6 | 0 |
| 知识图谱 | 5 | 0 |
| AI 助手 | 7 + 16 工具 | 0 |
| PDF 功能 | 7 | 0 |
| 数据库 | 6 | 0 |
| 闪卡系统 | 5 | 0 |
| 视频笔记 | 3 | 0 |
| 浏览器 | 4 | 0 |
| 界面主题 | 12 | 0 |
| **总计** | **~90** | **~8** |

---

## 🏗️ 技术栈

- **前端框架**: React 18 + TypeScript
- **桌面框架**: Tauri 2.0 (Rust)
- **编辑器**: CodeMirror 6
- **状态管理**: Zustand
- **样式**: TailwindCSS
- **Markdown**: marked + KaTeX + Mermaid
- **PDF**: pdfjs-dist
- **AI**: OpenAI API 兼容

---

*此文档由项目代码分析自动生成*
