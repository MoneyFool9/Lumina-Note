import { useMemo, useCallback } from "react";
import { parseMarkdown } from "@/lib/markdown";
import { useFileStore } from "@/stores/useFileStore";

interface ReadingViewProps {
  content: string;
  className?: string;
}

export function ReadingView({ content, className = "" }: ReadingViewProps) {
  const { fileTree, openFile } = useFileStore();

  const html = useMemo(() => {
    return parseMarkdown(content);
  }, [content]);

  // Handle WikiLink and Tag clicks
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // Handle WikiLink clicks
    if (target.classList.contains("wikilink")) {
      e.preventDefault();
      const linkName = target.getAttribute("data-wikilink");
      if (linkName) {
        // Find the file in fileTree
        const findFile = (entries: typeof fileTree): string | null => {
          for (const entry of entries) {
            if (entry.is_dir && entry.children) {
              const found = findFile(entry.children);
              if (found) return found;
            } else if (!entry.is_dir) {
              const fileName = entry.name.replace(".md", "");
              if (fileName.toLowerCase() === linkName.toLowerCase()) {
                return entry.path;
              }
            }
          }
          return null;
        };
        
        const filePath = findFile(fileTree);
        if (filePath) {
          openFile(filePath);
        } else {
          console.log(`笔记不存在: ${linkName}`);
        }
      }
    }
    
    // Handle Tag clicks - dispatch event to show tag in sidebar
    if (target.classList.contains("tag")) {
      e.preventDefault();
      const tagName = target.getAttribute("data-tag");
      if (tagName) {
        // Dispatch custom event for the right panel to handle
        window.dispatchEvent(
          new CustomEvent("tag-clicked", { detail: { tag: tagName } })
        );
      }
    }
  }, [fileTree, openFile]);

  return (
    <div
      className={`reading-view prose prose-neutral dark:prose-invert max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={handleClick}
    />
  );
}
