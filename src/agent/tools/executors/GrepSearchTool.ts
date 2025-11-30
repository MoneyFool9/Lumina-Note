/**
 * grep_search 工具执行器
 * 全文搜索，支持正则表达式
 */

import { ToolExecutor, ToolResult, ToolContext } from "../../types";
import { useFileStore } from "@/stores/useFileStore";
import { readFile, FileEntry } from "@/lib/tauri";

interface GrepMatch {
  path: string;
  line: number;
  content: string;
  matchText: string;
}

export const GrepSearchTool: ToolExecutor = {
  name: "grep_search",
  requiresApproval: false, // 只读操作

  async execute(
    params: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const query = params.query as string;
    const directory = params.directory as string | undefined;
    const isRegex = (params.regex as boolean) ?? false;
    const limit = (params.limit as number) || 50;
    const caseSensitive = (params.case_sensitive as boolean) ?? false;

    if (!query || typeof query !== "string") {
      return {
        success: false,
        content: "",
        error: "参数错误: query 必须是非空字符串",
      };
    }

    try {
      // 获取文件树
      const { fileTree } = useFileStore.getState();
      if (!fileTree || fileTree.length === 0) {
        return {
          success: false,
          content: "",
          error: "笔记库为空或未加载",
        };
      }

      // 构建搜索模式
      let pattern: RegExp;
      try {
        if (isRegex) {
          pattern = new RegExp(query, caseSensitive ? "g" : "gi");
        } else {
          // 转义特殊字符
          const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          pattern = new RegExp(escaped, caseSensitive ? "g" : "gi");
        }
      } catch (e) {
        return {
          success: false,
          content: "",
          error: `正则表达式错误: ${e instanceof Error ? e.message : "无效的正则"}`,
        };
      }

      // 获取所有文件
      const allFiles: { path: string; relativePath: string }[] = [];
      const flattenTree = (entries: FileEntry[], basePath: string = "") => {
        for (const entry of entries) {
          if (entry.is_dir && entry.children) {
            flattenTree(entry.children, basePath);
          } else if (!entry.is_dir && entry.name.endsWith(".md")) {
            // 计算相对路径
            const relativePath = entry.path.replace(context.workspacePath, "").replace(/^[/\\]/, "");
            
            // 如果指定了目录，过滤
            if (directory) {
              const normalizedDir = directory.replace(/\\/g, "/");
              const normalizedPath = relativePath.replace(/\\/g, "/");
              if (!normalizedPath.startsWith(normalizedDir)) {
                continue;
              }
            }
            
            allFiles.push({
              path: entry.path,
              relativePath,
            });
          }
        }
      };
      flattenTree(fileTree);

      // 搜索所有文件
      const matches: GrepMatch[] = [];
      
      for (const file of allFiles) {
        if (matches.length >= limit) break;

        try {
          const content = await readFile(file.path);
          const lines = content.split("\n");

          for (let i = 0; i < lines.length; i++) {
            if (matches.length >= limit) break;

            const line = lines[i];
            pattern.lastIndex = 0;
            const match = pattern.exec(line);

            if (match) {
              matches.push({
                path: file.relativePath,
                line: i + 1,
                content: line.trim().slice(0, 200),
                matchText: match[0],
              });
            }
          }
        } catch (error) {
          // 跳过无法读取的文件
          continue;
        }
      }

      if (matches.length === 0) {
        return {
          success: true,
          content: `未找到匹配 "${query}" 的结果。`,
        };
      }

      // 格式化结果
      const formattedResults = matches.map((m, i) => {
        return `${i + 1}. **${m.path}**:${m.line}\n   \`${m.content}\``;
      }).join("\n\n");

      const truncatedNote = matches.length >= limit 
        ? `\n\n(结果已截断，显示前 ${limit} 条)` 
        : "";

      return {
        success: true,
        content: `找到 ${matches.length} 处匹配:\n\n${formattedResults}${truncatedNote}`,
      };
    } catch (error) {
      return {
        success: false,
        content: "",
        error: `搜索失败: ${error instanceof Error ? error.message : "未知错误"}`,
      };
    }
  },
};
