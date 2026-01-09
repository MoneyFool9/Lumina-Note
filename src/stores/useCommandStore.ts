import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SlashCommand {
    id: string;
    key: string;
    description: string;
    prompt: string;
}

interface CommandState {
    commands: SlashCommand[];
    registerCommand: (cmd: Omit<SlashCommand, "id">) => void;
    updateCommand: (id: string, cmd: Partial<SlashCommand>) => void;
    deleteCommand: (id: string) => void;
    unregisterCommand: (key: string) => void; // Keep for backward compatibility if needed, or remove
}

export const useCommandStore = create<CommandState>()(
    persist(
        (set) => ({
            commands: [
                {
                    id: "default-explain",
                    key: "explain",
                    description: "解释代码",
                    prompt: "请详细解释这段代码：\n",
                },
                {
                    id: "default-fix",
                    key: "fix",
                    description: "修复 Bug",
                    prompt: "请修复以下代码中的 Bug：\n",
                },
                {
                    id: "default-translate",
                    key: "translate",
                    description: "翻译成中文",
                    prompt: "请将以下内容翻译成中文：\n",
                },
            ],
            registerCommand: (cmd) =>
                set((state) => ({
                    commands: [
                        ...state.commands.filter((c) => c.key !== cmd.key),
                        { ...cmd, id: Date.now().toString() },
                    ],
                })),
            updateCommand: (id, newCmd) =>
                set((state) => ({
                    commands: state.commands.map((c) =>
                        c.id === id ? { ...c, ...newCmd } : c
                    ),
                })),
            deleteCommand: (id) =>
                set((state) => ({
                    commands: state.commands.filter((c) => c.id !== id),
                })),
            unregisterCommand: (key) =>
                set((state) => ({
                    commands: state.commands.filter((c) => c.key !== key),
                })),
        }),
        {
            name: "lumina-commands",
            version: 1,
        }
    )
);
