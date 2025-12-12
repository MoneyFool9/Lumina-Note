# LangGraph 多智能体系统迁移指南

## 概述

本文档描述 Lumina Note Agent 系统从自定义循环迁移到 LangGraph 多智能体架构的设计和使用方法。

参考项目: [DeerFlow](https://github.com/bytedance/deer-flow)

## 架构

```
                    ┌─────────────┐
                    │   START     │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ coordinator │ ← 入口，理解用户意图
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
   ┌─────▼─────┐     ┌─────▼─────┐     ┌─────▼─────┐
   │  planner  │     │  editor   │     │ researcher│
   │ (复杂任务) │     │ (编辑)    │     │ (搜索)    │
   └─────┬─────┘     └─────┬─────┘     └─────┬─────┘
         │                 │                 │
   ┌─────▼─────┐           │                 │
   │ executor  │←──────────┴─────────────────┘
   │ (执行步骤) │
   └─────┬─────┘
         │
   ┌─────▼─────┐
   │ reporter  │ ← 汇总结果
   └─────┬─────┘
         │
   ┌─────▼─────┐
   │    END    │
   └───────────┘
```

## 核心组件

### 1. 智能体类型

| 智能体 | 职责 | 工具 |
|--------|------|------|
| coordinator | 入口，分析用户意图 | - |
| planner | 分解复杂任务 | - |
| executor | 执行计划步骤 | - |
| editor | 编辑笔记 | read_note, edit_note, search... |
| researcher | 搜索研究 | semantic_search, grep_search... |
| writer | 创建内容 | create_note, read_note... |
| organizer | 文件整理 | move_file, rename_file, delete_note... |
| reporter | 汇总报告 | - |

### 2. 意图分类

```typescript
type TaskIntent = 
  | "chat"      // 闲聊问答
  | "edit"      // 编辑笔记
  | "create"    // 创建内容
  | "organize"  // 整理文件
  | "search"    // 搜索研究
  | "complex";  // 复杂任务（需要规划）
```

### 3. 上下文压缩

参考 DeerFlow 的 `ContextManager`，在调用智能体前压缩消息：

```typescript
const contextManager = new ContextManager(tokenLimit, preservePrefixCount);
const compressed = contextManager.compress(messages);
```

策略：
- 保留头部 N 条消息（system prompt + 初始用户消息）
- 从尾部向前填充剩余空间
- 中间消息被丢弃

## 使用方法

### 基础用法

```typescript
import { getLangGraphAgentLoop } from "@/agent/langgraph";

const agent = getLangGraphAgentLoop({
  locale: "zh-CN",
  enableRAG: true,
  enableWikiLinks: true,
});

// 监听事件
agent.on("message_chunk", (event) => {
  console.log("消息:", event.data);
});

agent.on("tool_result", (event) => {
  console.log("工具结果:", event.data);
});

agent.on("complete", (event) => {
  console.log("完成:", event.data);
});

// 启动任务
await agent.startTask("帮我修改笔记标题", {
  workspacePath: "/path/to/workspace",
  activeNotePath: "/path/to/note.md",
  activeNoteContent: "...",
});
```

### 事件类型

| 事件 | 描述 |
|------|------|
| message_chunk | 智能体消息片段 |
| tool_call | 工具调用 |
| tool_result | 工具执行结果 |
| plan_created | 计划创建 |
| step_started | 步骤开始 |
| step_completed | 步骤完成 |
| interrupt | 中断等待 |
| complete | 任务完成 |
| error | 错误 |

## 文件结构

```
src/agent/langgraph/
├── types.ts              # 类型定义
├── ContextManager.ts     # 上下文压缩
├── AgentLoop.ts          # 主循环入口
├── index.ts              # 模块导出
├── tools/
│   ├── adapters.ts       # 工具适配器（Zod schema）
│   └── index.ts
└── graph/
    ├── types.ts          # 图状态类型（Annotation）
    ├── nodes.ts          # 节点实现
    ├── builder.ts        # 图构建器
    └── index.ts
```

## 与原有系统的差异

| 特性 | 原有系统 | LangGraph 系统 |
|------|----------|----------------|
| Agent 循环 | 自定义 while 循环 | StateGraph |
| 状态管理 | StateManager 手动管理 | Annotation 自动管理 |
| 工具调用 | XML 解析 + FC 双模式 | 原生 Function Calling |
| 多智能体 | 单 Agent 多模式 | 多节点编排 |
| 上下文压缩 | 工具结果摘要 | 全局消息压缩 |

## 渐进式迁移

目前两套系统并存：

- `src/agent/core/AgentLoop.ts` - 原有系统
- `src/agent/langgraph/AgentLoop.ts` - 新系统

建议迁移步骤：

1. ✅ 创建 LangGraph 基础架构
2. ⬜ 在设置中添加切换选项
3. ⬜ 测试各智能体功能
4. ⬜ 优化 Prompt 和工具调用
5. ⬜ 完成迁移，移除旧系统

## 已知限制

1. LangGraph JS 版本相比 Python 版本功能较少
2. 某些类型定义需要 `@ts-expect-error`
3. 流式输出需要进一步测试
4. 工具审批机制需要与 UI 集成

## 参考

- [LangGraph 文档](https://js.langchain.com/docs/langgraph)
- [DeerFlow 源码](https://github.com/bytedance/deer-flow)
