import { useState, useEffect, useRef, useCallback } from "react";
import { useFileStore } from "@/stores/useFileStore";
import { extractWikiLinks } from "./KnowledgeGraph";
import { readFile } from "@/lib/tauri";

interface LocalNode {
  id: string;
  label: string;
  path: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isCurrent: boolean;  // 是否是当前笔记
  isBacklink: boolean; // 是否是反向链接
}

interface LocalEdge {
  source: string;
  target: string;
}

interface LocalGraphProps {
  className?: string;
}

export function LocalGraph({ className = "" }: LocalGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const nodesRef = useRef<LocalNode[]>([]);
  const edgesRef = useRef<LocalEdge[]>([]);

  const { fileTree, currentFile, openFile, currentContent } = useFileStore();
  
  const [dimensions, setDimensions] = useState({ width: 200, height: 150 });
  const [hoverNode, setHoverNode] = useState<string | null>(null);

  // 从文件树中查找文件路径
  const findFilePath = useCallback((name: string): string | null => {
    const searchName = name.toLowerCase();
    
    const search = (entries: typeof fileTree): string | null => {
      for (const entry of entries) {
        if (entry.is_dir && entry.children) {
          const found = search(entry.children);
          if (found) return found;
        } else if (!entry.is_dir && entry.name.endsWith('.md')) {
          const entryName = entry.name.replace('.md', '').toLowerCase();
          if (entryName === searchName) {
            return entry.path;
          }
        }
      }
      return null;
    };
    
    return search(fileTree);
  }, [fileTree]);

  // 获取当前文件名（不含扩展名）
  const getCurrentFileName = useCallback((): string | null => {
    if (!currentFile) return null;
    const parts = currentFile.split(/[/\\]/);
    const fileName = parts[parts.length - 1];
    return fileName.replace('.md', '');
  }, [currentFile]);

  // 构建局部图谱
  const buildLocalGraph = useCallback(async () => {
    if (!currentFile || !currentFile.endsWith('.md')) {
      nodesRef.current = [];
      edgesRef.current = [];
      return;
    }

    const currentName = getCurrentFileName();
    if (!currentName) return;

    const nodes: LocalNode[] = [];
    const edges: LocalEdge[] = [];
    const nodeMap = new Map<string, LocalNode>();

    // 1. 创建当前笔记节点（中心）
    const width = containerRef.current?.offsetWidth || 200;
    const height = containerRef.current?.offsetHeight || 150;
    
    const currentNode: LocalNode = {
      id: currentName,
      label: currentName,
      path: currentFile,
      x: width / 2,
      y: height / 2,
      vx: 0,
      vy: 0,
      isCurrent: true,
      isBacklink: false,
    };
    nodes.push(currentNode);
    nodeMap.set(currentName.toLowerCase(), currentNode);

    // 2. 提取出链（当前笔记中的 [[links]]）
    const content = currentContent || '';
    const outLinks = extractWikiLinks(content);
    
    for (const linkName of outLinks) {
      const linkPath = findFilePath(linkName);
      if (linkPath && linkName.toLowerCase() !== currentName.toLowerCase()) {
        if (!nodeMap.has(linkName.toLowerCase())) {
          const node: LocalNode = {
            id: linkName,
            label: linkName,
            path: linkPath,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            isCurrent: false,
            isBacklink: false,
          };
          nodes.push(node);
          nodeMap.set(linkName.toLowerCase(), node);
        }
        edges.push({ source: currentName, target: linkName });
      }
    }

    // 3. 扫描反向链接（引用当前笔记的其他笔记）
    const scanBacklinks = async (entries: typeof fileTree) => {
      for (const entry of entries) {
        if (entry.is_dir && entry.children) {
          await scanBacklinks(entry.children);
        } else if (!entry.is_dir && entry.name.endsWith('.md') && entry.path !== currentFile) {
          try {
            const fileContent = await readFile(entry.path);
            const links = extractWikiLinks(fileContent);
            
            if (links.some(l => l.toLowerCase() === currentName.toLowerCase())) {
              const backLinkName = entry.name.replace('.md', '');
              
              if (!nodeMap.has(backLinkName.toLowerCase())) {
                const node: LocalNode = {
                  id: backLinkName,
                  label: backLinkName,
                  path: entry.path,
                  x: 0,
                  y: 0,
                  vx: 0,
                  vy: 0,
                  isCurrent: false,
                  isBacklink: true,
                };
                nodes.push(node);
                nodeMap.set(backLinkName.toLowerCase(), node);
              } else {
                // 如果节点已存在（作为出链），标记它也是反向链接
                const existingNode = nodeMap.get(backLinkName.toLowerCase());
                if (existingNode) existingNode.isBacklink = true;
              }
              
              // 添加反向边（从其他笔记指向当前笔记）
              if (!edges.some(e => e.source === backLinkName && e.target === currentName)) {
                edges.push({ source: backLinkName, target: currentName });
              }
            }
          } catch {
            // 忽略读取失败的文件
          }
        }
      }
    };

    await scanBacklinks(fileTree);

    // 4. 初始化节点位置（环形分布）
    const otherNodes = nodes.filter(n => !n.isCurrent);
    const angleStep = (2 * Math.PI) / Math.max(otherNodes.length, 1);
    const radius = Math.min(width, height) * 0.35;

    otherNodes.forEach((node, i) => {
      const angle = i * angleStep - Math.PI / 2;
      node.x = width / 2 + Math.cos(angle) * radius;
      node.y = height / 2 + Math.sin(angle) * radius;
    });

    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [currentFile, currentContent, fileTree, findFilePath, getCurrentFileName]);

  // 当前文件或内容变化时重建图谱
  useEffect(() => {
    buildLocalGraph();
  }, [buildLocalGraph]);

  // 监听容器尺寸
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { offsetWidth, offsetHeight } = containerRef.current;
        setDimensions({ width: offsetWidth, height: offsetHeight });
      }
    };
    
    updateSize();
    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => observer.disconnect();
  }, []);

  // 简单物理模拟
  const simulate = useCallback(() => {
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const { width, height } = dimensions;
    const cx = width / 2;
    const cy = height / 2;

    // 中心节点固定
    const centerNode = nodes.find(n => n.isCurrent);
    if (centerNode) {
      centerNode.x = cx;
      centerNode.y = cy;
    }

    // 节点间斥力
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].isCurrent) continue;
      for (let j = i + 1; j < nodes.length; j++) {
        if (nodes[j].isCurrent) continue;
        
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = 500 / (dist * dist);
        
        nodes[i].vx += (dx / dist) * force * 0.1;
        nodes[i].vy += (dy / dist) * force * 0.1;
        nodes[j].vx -= (dx / dist) * force * 0.1;
        nodes[j].vy -= (dy / dist) * force * 0.1;
      }
    }

    // 弹簧力（边）
    edges.forEach(edge => {
      const u = nodes.find(n => n.id === edge.source);
      const v = nodes.find(n => n.id === edge.target);
      if (!u || !v) return;

      const dx = v.x - u.x;
      const dy = v.y - u.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const targetDist = Math.min(width, height) * 0.3;
      const force = (dist - targetDist) * 0.02;

      if (!u.isCurrent) {
        u.vx += (dx / dist) * force;
        u.vy += (dy / dist) * force;
      }
      if (!v.isCurrent) {
        v.vx -= (dx / dist) * force;
        v.vy -= (dy / dist) * force;
      }
    });

    // 更新位置
    nodes.forEach(node => {
      if (node.isCurrent) return;
      
      node.x += node.vx;
      node.y += node.vy;
      node.vx *= 0.9;
      node.vy *= 0.9;

      // 边界约束
      const margin = 20;
      node.x = Math.max(margin, Math.min(width - margin, node.x));
      node.y = Math.max(margin, Math.min(height - margin, node.y));
    });
  }, [dimensions]);

  // 渲染
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensions;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    simulate();

    ctx.clearRect(0, 0, width, height);

    // 绘制边
    edgesRef.current.forEach(edge => {
      const u = nodesRef.current.find(n => n.id === edge.source);
      const v = nodesRef.current.find(n => n.id === edge.target);
      if (!u || !v) return;

      const isHighlighted = hoverNode && (u.id === hoverNode || v.id === hoverNode);

      ctx.beginPath();
      ctx.moveTo(u.x, u.y);
      ctx.lineTo(v.x, v.y);
      ctx.strokeStyle = isHighlighted 
        ? '#3b82f6' 
        : 'rgba(128, 128, 128, 0.3)';
      ctx.lineWidth = isHighlighted ? 1.5 : 1;
      ctx.stroke();

      // 绘制箭头
      const angle = Math.atan2(v.y - u.y, v.x - u.x);
      const arrowLen = 6;
      const targetRadius = v.isCurrent ? 10 : 6;
      const arrowX = v.x - Math.cos(angle) * (targetRadius + 2);
      const arrowY = v.y - Math.sin(angle) * (targetRadius + 2);

      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(
        arrowX - arrowLen * Math.cos(angle - Math.PI / 6),
        arrowY - arrowLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(
        arrowX - arrowLen * Math.cos(angle + Math.PI / 6),
        arrowY - arrowLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.stroke();
    });

    // 绘制节点
    nodesRef.current.forEach(node => {
      const isHovered = node.id === hoverNode;
      const radius = node.isCurrent ? 10 : 6;

      // 节点圆
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      
      if (node.isCurrent) {
        ctx.fillStyle = '#3b82f6'; // 蓝色 - 当前笔记
      } else if (node.isBacklink) {
        ctx.fillStyle = '#22c55e'; // 绿色 - 反向链接
      } else {
        ctx.fillStyle = '#60a5fa'; // 浅蓝色 - 出链
      }
      ctx.fill();

      if (isHovered) {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // 标签
      if (isHovered || node.isCurrent) {
        ctx.fillStyle = '#333';
        ctx.font = `${node.isCurrent ? 'bold ' : ''}10px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(node.label, node.x, node.y + radius + 12);
      }
    });

    animationRef.current = requestAnimationFrame(render);
  }, [dimensions, hoverNode, simulate]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(render);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [render]);

  // 交互处理
  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hovered = nodesRef.current.find(n => {
      const r = n.isCurrent ? 12 : 8;
      return Math.hypot(n.x - x, n.y - y) < r;
    });

    setHoverNode(hovered ? hovered.id : null);
    if (canvasRef.current) {
      canvasRef.current.style.cursor = hovered ? 'pointer' : 'default';
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clicked = nodesRef.current.find(n => {
      const r = n.isCurrent ? 12 : 8;
      return Math.hypot(n.x - x, n.y - y) < r;
    });

    if (clicked && !clicked.isCurrent) {
      openFile(clicked.path);
    }
  };

  // 如果没有当前文件或不是 md 文件，显示空状态
  if (!currentFile || !currentFile.endsWith('.md')) {
    return (
      <div className={`flex items-center justify-center text-muted-foreground text-xs ${className}`}>
        无关联笔记
      </div>
    );
  }

  const outLinkCount = nodesRef.current.filter(n => !n.isCurrent && !n.isBacklink).length;
  const backLinkCount = nodesRef.current.filter(n => n.isBacklink).length;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        className="w-full h-full"
      />
      {/* 图例 */}
      <div className="absolute bottom-1 left-1 text-[9px] text-muted-foreground opacity-80">
        <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: '#3b82f6' }} />当前
        {outLinkCount > 0 && (
          <>
            <span className="inline-block w-2 h-2 rounded-full ml-2 mr-1" style={{ background: '#60a5fa' }} />出链({outLinkCount})
          </>
        )}
        {backLinkCount > 0 && (
          <>
            <span className="inline-block w-2 h-2 rounded-full ml-2 mr-1" style={{ background: '#22c55e' }} />入链({backLinkCount})
          </>
        )}
      </div>
    </div>
  );
}

export default LocalGraph;
