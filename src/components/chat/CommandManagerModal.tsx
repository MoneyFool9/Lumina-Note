import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { SlashCommand } from "@/stores/useCommandStore";

interface CommandManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (cmd: Omit<SlashCommand, "id">) => void;
    initialData?: SlashCommand | null;
}

export function CommandManagerModal({
    isOpen,
    onClose,
    onSave,
    initialData,
}: CommandManagerModalProps) {
    const [key, setKey] = useState("");
    const [description, setDescription] = useState("");
    const [prompt, setPrompt] = useState("");

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setKey(initialData.key);
                setDescription(initialData.description);
                setPrompt(initialData.prompt);
            } else {
                setKey("");
                setDescription("");
                setPrompt("");
            }
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!key.trim() || !prompt.trim()) return;

        // Remove leading slash if user added it
        const cleanKey = key.trim().replace(/^\//, "");

        onSave({
            key: cleanKey,
            description: description.trim(),
            prompt: prompt,
        });
        onClose();
    };

    return (
        <div role="dialog" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md bg-background border border-border rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                    <h3 className="font-medium">
                        {initialData ? "编辑快捷方式" : "创建快捷方式"}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-muted rounded-md transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-muted-foreground">
                            触发词 (Key)
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-muted-foreground">/</span>
                            <input
                                type="text"
                                value={key}
                                onChange={(e) => setKey(e.target.value)}
                                placeholder="例如: explain"
                                className="w-full pl-6 pr-3 py-2 bg-muted/50 border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                                autoFocus
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            输入 / + 触发词 来快速调用此命令
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-muted-foreground">
                            描述 (Description)
                        </label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="例如: 解释代码"
                            className="w-full px-3 py-2 bg-muted/50 border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-muted-foreground">
                            提示词 (Prompt)
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="输入要注入的提示词..."
                            rows={4}
                            className="w-full px-3 py-2 bg-muted/50 border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                        />
                        <p className="text-xs text-muted-foreground">
                            此内容将自动添加到您的消息前面
                        </p>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-1.5 text-sm hover:bg-muted rounded-md transition-colors"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            disabled={!key.trim() || !prompt.trim()}
                            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50"
                        >
                            保存
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
