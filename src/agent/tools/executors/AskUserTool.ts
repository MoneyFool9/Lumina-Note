/**
 * ask_user 工具执行器
 * 向用户提问并等待回复
 */

import { ToolExecutor, ToolResult, ToolContext } from "../../types";

/**
 * ask_user 是一个特殊工具：
 * - 执行时会暂停 Agent 循环
 * - 将问题显示给用户
 * - 等待用户回复后继续
 * 
 * 实际的问答流程在 AgentLoop 中处理
 * 这里只返回一个特殊标记
 */
export const AskUserTool: ToolExecutor = {
  name: "ask_user",
  requiresApproval: false, // 不需要审批，但会暂停等待用户回复

  async execute(
    params: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    const question = params.question as string;
    const options = params.options as string[] | undefined;

    if (!question || typeof question !== "string") {
      return {
        success: false,
        content: "",
        error: "参数错误: question 必须是非空字符串",
      };
    }

    // 构建问题展示内容
    let displayContent = `**Agent 提问**: ${question}`;
    
    if (options && Array.isArray(options) && options.length > 0) {
      displayContent += "\n\n**选项**:\n" + options.map((opt, i) => `${i + 1}. ${opt}`).join("\n");
    }

    // 返回特殊结果，表示需要等待用户输入
    // AgentLoop 会检测这个工具并暂停循环
    return {
      success: true,
      content: displayContent,
      // 特殊标记，告诉 AgentLoop 需要等待用户回复
      // @ts-ignore - 扩展属性
      waitForUserInput: true,
      question,
      options,
    };
  },
};
