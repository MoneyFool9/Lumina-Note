/**
 * semantic_search 工具执行器
 * 基于 RAG 系统的语义搜索
 */

import { ToolExecutor, ToolResult, ToolContext } from "../../types";
import { useRAGStore } from "@/stores/useRAGStore";
import type { SearchResult } from "@/services/rag";

export const SemanticSearchTool: ToolExecutor = {
  name: "semantic_search",
  requiresApproval: false, // 只读操作

  async execute(
    params: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    const query = params.query as string;
    const directory = params.directory as string | undefined;
    const limit = (params.limit as number) || 10;
    const minScore = (params.min_score as number) || 0.3;

    if (!query || typeof query !== "string") {
      return {
        success: false,
        content: "",
        error: "参数错误: query 必须是非空字符串",
      };
    }

    try {
      // 获取 RAG 管理器
      const ragManager = useRAGStore.getState().ragManager;

      if (!ragManager || !ragManager.isInitialized()) {
        return {
          success: false,
          content: "",
          error: "RAG 系统未初始化。请先在设置中配置 embedding API 并建立索引。",
        };
      }

      // 执行语义搜索
      const results = await ragManager.search(query, {
        limit,
        directory,
      });

      // 过滤低分结果
      const filteredResults = results.filter(
        (r: SearchResult) => r.score >= minScore
      );

      if (filteredResults.length === 0) {
        return {
          success: true,
          content: `未找到与 "${query}" 语义相关的内容 (最低相似度: ${minScore * 100}%)。\n\n提示: 可以尝试降低 min_score 参数或使用 grep_search 进行关键词搜索。`,
        };
      }

      // 格式化结果
      const formattedResults = filteredResults
        .map((r: SearchResult, i: number) => {
          const score = (r.score * 100).toFixed(1);
          const preview =
            r.content.length > 400
              ? r.content.substring(0, 400) + "..."
              : r.content;

          return `### ${i + 1}. ${r.filePath} (相似度: ${score}%)
**章节**: ${r.heading || "无标题"}
**位置**: 第 ${r.startLine}-${r.endLine} 行

\`\`\`
${preview}
\`\`\``;
        })
        .join("\n\n---\n\n");

      return {
        success: true,
        content: `找到 ${filteredResults.length} 个语义相关结果:\n\n${formattedResults}`,
      };
    } catch (error) {
      return {
        success: false,
        content: "",
        error: `语义搜索失败: ${error instanceof Error ? error.message : "未知错误"}`,
      };
    }
  },
};
