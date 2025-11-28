/**
 * AI 悬浮球组件
 * 可拖拽，点击展开 AI 面板
 */

import { useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useUIStore } from "@/stores/useUIStore";
import { Bot, X, Dock } from "lucide-react";
import { AIFloatingPanel } from "./AIFloatingPanel";

export function AIFloatingBall() {
  const {
    aiPanelMode,
    floatingBallPosition,
    floatingPanelOpen,
    isFloatingBallDragging,
    setAIPanelMode,
    setFloatingBallPosition,
    toggleFloatingPanel,
    setFloatingPanelOpen,
    setFloatingBallDragging,
  } = useUIStore();

  const ballRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: 28, y: 28 }); // 使用 ref 避免重渲染

  // 处理拖拽 - hooks 必须在条件判断之前
  useEffect(() => {
    if (!isFloatingBallDragging || aiPanelMode !== "floating") return;

    let rafId: number | null = null;
    let lastX = floatingBallPosition.x;
    let lastY = floatingBallPosition.y;

    const handleMouseMove = (e: MouseEvent) => {
      // 计算新位置
      lastX = Math.max(0, Math.min(window.innerWidth - 56, e.clientX - dragOffsetRef.current.x));
      lastY = Math.max(0, Math.min(window.innerHeight - 56, e.clientY - dragOffsetRef.current.y));
      
      // 使用 RAF 节流更新
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          setFloatingBallPosition({ x: lastX, y: lastY });
          rafId = null;
        });
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      setFloatingBallDragging(false);
      
      // 检测是否拖到右侧边缘（回归 dock 模式）
      if (e.clientX > window.innerWidth - 100) {
        setAIPanelMode("docked");
        setFloatingPanelOpen(false);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isFloatingBallDragging, aiPanelMode, floatingBallPosition.x, floatingBallPosition.y, setFloatingBallPosition, setAIPanelMode, setFloatingPanelOpen, setFloatingBallDragging]);

  // 只在 floating 模式下显示 - 条件判断必须在 hooks 之后
  if (aiPanelMode !== "floating") return null;

  // 处理拖拽开始
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // 只响应左键
    e.preventDefault();
    
    const rect = ballRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
    setFloatingBallDragging(true);
  };

  // 点击悬浮球
  const handleClick = () => {
    if (!isFloatingBallDragging) {
      toggleFloatingPanel();
    }
  };

  // 回归停靠模式
  const handleDock = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAIPanelMode("docked");
    setFloatingPanelOpen(false);
  };

  return createPortal(
    <>
      {/* 悬浮球 */}
      <div
        ref={ballRef}
        data-floating-ball
        className={`fixed z-50 select-none ${isFloatingBallDragging ? "cursor-grabbing" : "cursor-grab"}`}
        style={{
          left: floatingBallPosition.x,
          top: floatingBallPosition.y,
        }}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
      >
        <div
          className={`
            w-14 h-14 rounded-full shadow-lg 
            flex items-center justify-center
            transition-all duration-200
            ${floatingPanelOpen 
              ? "bg-primary text-primary-foreground" 
              : "bg-background border border-border hover:bg-muted"
            }
            ${isFloatingBallDragging ? "scale-110 shadow-xl" : "hover:scale-105"}
          `}
        >
          {floatingPanelOpen ? (
            <X size={24} />
          ) : (
            <Bot size={24} className="text-primary" />
          )}
        </div>
        
        {/* 回归 dock 的提示 (拖拽时显示) */}
        {isFloatingBallDragging && floatingBallPosition.x > window.innerWidth - 150 && (
          <div className="absolute -left-20 top-1/2 -translate-y-1/2 bg-primary text-primary-foreground px-2 py-1 rounded text-xs whitespace-nowrap">
            松开回归侧栏
          </div>
        )}
      </div>

      {/* 悬浮面板 */}
      {floatingPanelOpen && (
        <AIFloatingPanel 
          ballPosition={floatingBallPosition} 
          onDock={handleDock}
        />
      )}

      {/* 拖拽到右侧时的高亮区域 */}
      {isFloatingBallDragging && (
        <div 
          className={`
            fixed right-0 top-0 w-24 h-full z-40
            transition-all duration-200
            ${floatingBallPosition.x > window.innerWidth - 150 
              ? "bg-primary/20 border-l-2 border-primary" 
              : "bg-transparent"
            }
          `}
        >
          <div className="flex items-center justify-center h-full">
            {floatingBallPosition.x > window.innerWidth - 150 && (
              <Dock size={32} className="text-primary animate-pulse" />
            )}
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
