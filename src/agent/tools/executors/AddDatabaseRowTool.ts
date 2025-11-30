/**
 * add_database_row 工具执行器
 * 添加数据库行（创建笔记并设置 frontmatter）
 */

import { ToolExecutor, ToolResult, ToolContext } from "../../types";
import { useDatabaseStore } from "@/stores/useDatabaseStore";
import type { CellValue } from "@/types/database";

export const AddDatabaseRowTool: ToolExecutor = {
  name: "add_database_row",
  requiresApproval: true, // 写入操作需要审批

  async execute(
    params: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    const dbId = params.database_id as string;
    const cellsRaw = params.cells as Record<string, unknown> | string | undefined;

    if (!dbId || typeof dbId !== "string") {
      return {
        success: false,
        content: "",
        error: "参数错误: database_id 必须是非空字符串",
      };
    }

    try {
      const { loadDatabase, databases, addRow, listDatabases } = useDatabaseStore.getState();

      // 列出所有数据库供参考
      const allDbIds = await listDatabases();

      // 尝试加载数据库
      let db = databases[dbId];
      if (!db) {
        const loaded = await loadDatabase(dbId);
        if (!loaded) {
          return {
            success: false,
            content: "",
            error: `数据库不存在: ${dbId}\n\n可用数据库: ${allDbIds.join(", ") || "无"}`,
          };
        }
        db = loaded;
      }

      if (!db) {
        return {
          success: false,
          content: "",
          error: `数据库不存在: ${dbId}\n\n可用数据库: ${allDbIds.join(", ") || "无"}`,
        };
      }

      // 解析 cells 参数
      let cells: Record<string, CellValue> = {};
      if (cellsRaw) {
        if (typeof cellsRaw === "string") {
          try {
            cells = JSON.parse(cellsRaw);
          } catch {
            return {
              success: false,
              content: "",
              error: "参数错误: cells 必须是有效的 JSON 对象",
            };
          }
        } else {
          cells = cellsRaw as Record<string, CellValue>;
        }
      }

      // 将列名转换为列 ID，并处理 select/multi-select 值
      const cellsById: Record<string, CellValue> = {};
      for (const [key, value] of Object.entries(cells)) {
        // 尝试按名称查找列
        const column = db.columns.find(
          (c) => c.name === key || c.id === key
        );
        if (column) {
          // 对于 select/multi-select 类型，将选项名称转换为选项 ID
          if ((column.type === 'select' || column.type === 'multi-select') && column.options) {
            if (Array.isArray(value)) {
              // multi-select: 转换数组中的每个值
              cellsById[column.id] = value.map(v => {
                const option = column.options?.find(o => o.name === v || o.id === v);
                return option?.id || v;
              });
            } else {
              // select: 转换单个值
              const option = column.options.find(o => o.name === value || o.id === value);
              cellsById[column.id] = option?.id || value as CellValue;
            }
          } else {
            cellsById[column.id] = value as CellValue;
          }
        } else {
          console.warn(`未知列: ${key}`);
        }
      }

      // 添加行（会创建笔记并设置 frontmatter）
      const rowId = await addRow(dbId, cellsById);

      // 获取更新后的数据库
      const updatedDb = useDatabaseStore.getState().databases[dbId];
      const newRow = updatedDb?.rows.find((r) => r.id === rowId);

      // 构建反馈信息
      const columnsInfo = db.columns.map((c) => `${c.name} (${c.type})`).join(", ");
      const addedValues = Object.entries(cellsById)
        .map(([colId, val]) => {
          const col = db.columns.find((c) => c.id === colId);
          return col ? `${col.name}: ${val}` : null;
        })
        .filter(Boolean)
        .join(", ");

      return {
        success: true,
        content: `已向数据库 "${db.name}" 添加新行。
        
**行 ID**: ${rowId}
**笔记路径**: ${newRow?.notePath || "未知"}
**设置的值**: ${addedValues || "无"}

**可用列**: ${columnsInfo}`,
      };
    } catch (error) {
      return {
        success: false,
        content: "",
        error: `添加数据库行失败: ${error instanceof Error ? error.message : "未知错误"}`,
      };
    }
  },
};
