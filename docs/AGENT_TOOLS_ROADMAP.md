# Agent 工具系统设计文档

## 目录结构

```
src/agent/
├── core/           # Agent 核心循环
│   └── loop.ts     # Agent 执行循环
├── modes/          # Agent 模式定义
│   ├── editor.ts   # 编辑模式
│   ├── organizer.ts # 整理模式
│   ├── researcher.ts # 研究模式
│   └── writer.ts   # 写作模式
├── tools/          # 工具定义和执行
│   ├── definitions.ts # 工具定义（XML 格式）
│   └── executors/  # 工具执行器
│       ├── ReadNoteTool.ts
│       ├── EditNoteTool.ts
│       ├── WriteNoteTool.ts
│       ├── ListNotesTool.ts
│       ├── MoveNoteTool.ts
│       ├── SearchNotesTool.ts
│       └── AttemptCompletionTool.ts
├── prompts/        # System prompts
└── index.ts        # 入口文件
```

---

## 一、主流 AI IDE 工具参考

### Cursor / Windsurf / Copilot 工具集

#### 📁 文件操作
| 工具 | 功能 | 我们是否需要 |
|------|------|-------------|
| `read_file` | 读取文件内容 | ✅ 已实现 (read_note) |
| `write_file` | 创建新文件 | ✅ 已实现 (write_note) |
| `edit_file` | 编辑现有文件（精确替换） | ✅ 已实现 (edit_note) |
| `delete_file` | 删除文件 | ✅ 已实现 (delete_note) |
| `rename_file` | 重命名/移动文件 | ✅ 已实现 (move_note) |
| `list_directory` | 列出目录结构 | ✅ 已实现 (list_notes) |

#### 🔍 搜索与导航
| 工具 | 功能 | 我们是否需要 |
|------|------|-------------|
| `grep_search` | 全文搜索（正则支持） | ✅ 已实现 |
| `find_files` | 按文件名模糊查找 | ⬜ 待实现 |
| `semantic_search` | 语义搜索（RAG） | ✅ 已实现 |

#### 🌐 网络与知识
| 工具 | 功能 | 我们是否需要 |
|------|------|-------------|
| `web_search` | 网络搜索 | ⬜ 待实现 |
| `fetch_url` | 获取网页内容 | ⬜ 待实现 |
| `read_pdf` | 读取 PDF 内容 | ⬜ 待实现 |

#### 📊 数据库操作（笔记软件特有）
| 工具 | 功能 | 我们是否需要 |
|------|------|-------------|
| `list_databases` | 列出所有数据库 | ⬜ 待实现 (可用 list_notes Databases/) |
| `query_database` | 查询数据库行 | ✅ 已实现 |
| `add_database_row` | 添加数据库行 | ✅ 已实现 |
| `update_database_row` | 更新数据库行 | ⬜ 待实现 |

#### 🔗 笔记关系（笔记软件特有）
| 工具 | 功能 | 我们是否需要 |
|------|------|-------------|
| `get_backlinks` | 获取反向链接 | ✅ 已实现 |
| `get_outlinks` | 获取正向链接 | ⬜ 待实现 |
| `create_link` | 创建笔记链接 | ⬜ 待实现 |

#### 🧠 上下文与记忆
| 工具 | 功能 | 我们是否需要 |
|------|------|-------------|
| `ask_user` | 向用户提问确认 | ✅ 已实现 |
| `save_memory` | 保存重要信息 | ⬜ 待实现 |

#### ✅ 完成
| 工具 | 功能 | 我们是否需要 |
|------|------|-------------|
| `attempt_completion` | 完成任务 | ✅ 已实现 |

---

## 二、当前已实现工具

### 已实现 (14个)

| 工具名 | 文件位置 | 功能描述 |
|--------|----------|----------|
| `read_note` | `tools/executors/ReadNoteTool.ts` | 读取笔记内容 |
| `edit_note` | `tools/executors/EditNoteTool.ts` | 编辑笔记（带实时预览动画） |
| `write_note` | `tools/executors/WriteNoteTool.ts` | 创建新笔记 |
| `list_notes` | `tools/executors/ListNotesTool.ts` | 列出目录下的笔记 |
| `move_note` | `tools/executors/MoveNoteTool.ts` | 移动/重命名笔记 |
| `delete_note` | `tools/executors/DeleteNoteTool.ts` | 删除笔记文件 |
| `search_notes` | `tools/executors/SearchNotesTool.ts` | 语义搜索笔记内容 |
| `grep_search` | `tools/executors/GrepSearchTool.ts` | 全文搜索（支持正则） |
| `semantic_search` | `tools/executors/SemanticSearchTool.ts` | 基于 RAG 的语义搜索 |
| `query_database` | `tools/executors/QueryDatabaseTool.ts` | 查询数据库行 |
| `add_database_row` | `tools/executors/AddDatabaseRowTool.ts` | 添加数据库行 |
| `get_backlinks` | `tools/executors/GetBacklinksTool.ts` | 获取反向链接 |
| `ask_user` | `tools/executors/AskUserTool.ts` | 向用户提问 |
| `attempt_completion` | `tools/executors/AttemptCompletionTool.ts` | 完成任务并返回结果 |

---

## 三、待实现工具优先级

### 🟢 低优先级（未来扩展）

| 工具 | 理由 |
|------|------|
| `web_search` | 需要外部 API |
| `fetch_url` | 需要处理各种网页格式 |
| `read_pdf` | 需要 PDF 解析库 |
| `get_outlinks` | 获取正向链接 |
| `update_database_row` | 更新数据库行 |
| `save_memory` | 保存 Agent 记忆 |

---

## 四、工具开发指南

### 添加新工具步骤

1. **定义工具** - 在 `tools/definitions.ts` 中添加 XML 格式定义
2. **实现执行器** - 在 `tools/executors/` 下创建 `XxxTool.ts`
3. **注册工具** - 在 `tools/index.ts` 中注册
4. **测试** - 在 Agent 对话中测试

### 工具定义示例

```typescript
// tools/definitions.ts
export const TOOL_DEFINITIONS = `
<tool name="grep_search">
  <description>在笔记中进行全文搜索，支持正则表达式</description>
  <parameters>
    <parameter name="query" required="true">搜索关键词或正则表达式</parameter>
    <parameter name="path" required="false">搜索范围路径，默认全库</parameter>
    <parameter name="regex" required="false">是否启用正则，默认 false</parameter>
  </parameters>
</tool>
`;
```

### 执行器示例

```typescript
// tools/executors/GrepSearchTool.ts
export async function executeGrepSearch(params: {
  query: string;
  path?: string;
  regex?: boolean;
}): Promise<string> {
  // 实现搜索逻辑
  // 返回格式化的搜索结果
}
```

---

## 五、参考资料

- [Cursor 文档](https://cursor.sh/docs)
- [Anthropic Claude Tool Use](https://docs.anthropic.com/claude/docs/tool-use)
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)
