/**
 * AI 悬浮面板
 * 在悬浮球模式下显示的 AI 对话面板
 */

import React, { useRef, useEffect, useState } from "react";
import { useUIStore } from "@/stores/useUIStore";
import { useAIStore } from "@/stores/useAIStore";
import { useFileStore } from "@/stores/useFileStore";
import { 
  Bot, 
  BrainCircuit, 
  Settings, 
  Trash2, 
  Dock,
  Send,
  Loader2,
} from "lucide-react";
import { AgentPanel } from "./AgentPanel";
import { PROVIDER_REGISTRY, type LLMProviderType } from "@/services/llm";

interface AIFloatingPanelProps {
  ballPosition: { x: number; y: number };
  onDock: (e: React.MouseEvent) => void;
}

export function AIFloatingPanel({ ballPosition, onDock }: AIFloatingPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { chatMode, setChatMode, setFloatingPanelOpen } = useUIStore();
  const { 
    config, 
    setConfig, 
    clearChat,
    messages,
    isLoading,
    error,
    sendMessage,
  } = useAIStore();
  const { currentFile, currentContent } = useFileStore();

  const [showSettings, setShowSettings] = useState(false);
  const [inputValue, setInputValue] = useState("");

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 计算面板位置（在悬浮球旁边）
  const getPanelPosition = () => {
    const panelWidth = 380;
    const panelHeight = 500;
    const padding = 16;
    
    let x = ballPosition.x - panelWidth - padding;
    let y = ballPosition.y - panelHeight / 2 + 28;
    
    // 边界检测
    if (x < padding) {
      x = ballPosition.x + 70; // 显示在右侧
    }
    if (y < padding) {
      y = padding;
    }
    if (y + panelHeight > window.innerHeight - padding) {
      y = window.innerHeight - panelHeight - padding;
    }
    
    return { x, y };
  };

  const position = getPanelPosition();

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // 检查是否点击了悬浮球
        const target = e.target as HTMLElement;
        if (!target.closest('[data-floating-ball]')) {
          setFloatingPanelOpen(false);
        }
      }
    };

    // 延迟添加事件监听，避免立即触发
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [setFloatingPanelOpen]);

  return (
    <div
      ref={panelRef}
      className="fixed z-50 bg-background border border-border rounded-xl shadow-2xl overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        width: 380,
        height: 500,
      }}
    >
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2">
          {/* Mode Toggle */}
          <div className="flex bg-muted rounded-md p-0.5">
            <button
              onClick={() => setChatMode("agent")}
              className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                chatMode === "agent"
                  ? "bg-background text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Agent 模式"
            >
              <Bot size={12} />
              Agent
            </button>
            <button
              onClick={() => setChatMode("chat")}
              className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                chatMode === "chat"
                  ? "bg-background text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="对话模式"
            >
              <BrainCircuit size={12} />
              对话
            </button>
          </div>
          <span className="text-xs text-muted-foreground">
            {config.apiKey ? "✓" : "未配置"}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={clearChat}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-muted"
            title="清空对话"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-muted"
            title="设置"
          >
            <Settings size={14} />
          </button>
          <button
            onClick={onDock}
            className="p-1.5 text-muted-foreground hover:text-primary transition-colors rounded hover:bg-muted"
            title="回归侧栏"
          >
            <Dock size={14} />
          </button>
        </div>
      </div>

      {/* Settings Panel (Collapsed by default) */}
      {showSettings && (
        <div className="p-3 border-b border-border bg-muted/30 space-y-2 max-h-48 overflow-y-auto">
          <div className="space-y-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">服务商</label>
              <select
                value={config.provider}
                onChange={(e) => {
                  const provider = e.target.value as LLMProviderType;
                  const providerMeta = PROVIDER_REGISTRY[provider];
                  const defaultModel = providerMeta?.models[0]?.id || "";
                  setConfig({ provider, model: defaultModel });
                }}
                className="w-full text-xs p-2 rounded border border-border bg-background"
              >
                {Object.entries(PROVIDER_REGISTRY).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">API Key</label>
              <input
                type="password"
                value={config.apiKey}
                onChange={(e) => setConfig({ apiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full text-xs p-2 rounded border border-border bg-background"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">模型</label>
              <select
                value={config.model}
                onChange={(e) => setConfig({ model: e.target.value })}
                className="w-full text-xs p-2 rounded border border-border bg-background"
              >
                {PROVIDER_REGISTRY[config.provider as LLMProviderType]?.models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ height: showSettings ? 'calc(100% - 200px)' : 'calc(100% - 52px)' }}>
        {chatMode === "agent" ? (
          <AgentPanel />
        ) : (
          <>
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.length === 0 && (
                <div className="text-sm text-muted-foreground leading-relaxed">
                  <p>你好！我可以帮你编辑笔记。</p>
                </div>
              )}
              {messages.map((msg, idx) => (
                <div key={idx} className={`${msg.role === "user" ? "flex justify-end" : ""}`}>
                  {msg.role === "user" ? (
                    <div className="max-w-[85%] bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-3 py-2 text-sm">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 size={14} className="animate-spin" />
                  <span>思考中...</span>
                </div>
              )}
              {error && (
                <div className="text-sm text-red-500 p-2 bg-red-500/10 rounded">
                  {error}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Input */}
            <div className="p-2 border-t border-border">
              <div className="flex gap-2">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="输入消息..."
                  className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm resize-none outline-none focus:ring-1 focus:ring-primary/50"
                  rows={2}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isLoading}
                  className="self-end bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-lg p-2 transition-colors"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  // 发送消息
  function handleSend() {
    if (!inputValue.trim() || isLoading) return;
    
    const fileContext = currentFile ? {
      path: currentFile,
      name: currentFile.split(/[/\\]/).pop() || "",
      content: currentContent,
    } : undefined;
    
    sendMessage(inputValue.trim(), fileContext);
    setInputValue("");
  }
}
