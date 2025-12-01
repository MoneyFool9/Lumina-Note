import { useState } from "react";
import { PDFThumbnails } from "./PDFThumbnails";
import { PDFOutline } from "./PDFOutline";
import { FileText, List } from "lucide-react";

interface PDFSidebarProps {
  filePath: string;
  numPages: number;
  currentPage: number;
  onPageClick: (page: number) => void;
  collapsed?: boolean;
}

export function PDFSidebar({
  filePath,
  numPages,
  currentPage,
  onPageClick,
  collapsed = false,
}: PDFSidebarProps) {
  const [activeTab, setActiveTab] = useState<"thumbnails" | "outline">("thumbnails");

  if (collapsed) {
    return null;
  }

  return (
    <div className="flex flex-col h-full border-r border-border bg-muted/30 w-64">
      {/* Tab Header */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("thumbnails")}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === "thumbnails"
              ? "bg-background text-foreground border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText size={14} className="inline mr-1" />
          缩略图
        </button>
        <button
          onClick={() => setActiveTab("outline")}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === "outline"
              ? "bg-background text-foreground border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <List size={14} className="inline mr-1" />
          目录
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "thumbnails" ? (
          <PDFThumbnails
            filePath={filePath}
            numPages={numPages}
            currentPage={currentPage}
            onPageClick={onPageClick}
            collapsed={false}
          />
        ) : (
          <PDFOutline
            filePath={filePath}
            onPageClick={onPageClick}
          />
        )}
      </div>
    </div>
  );
}
