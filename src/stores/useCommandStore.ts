import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getCurrentTranslations } from "./useLocaleStore";

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

// 根据当前语言获取默认命令
export const getDefaultCommands = (): SlashCommand[] => {
    const t = getCurrentTranslations();

    return [
        {
            id: "default-explain",
            key: "explain",
            description: t.ai.slashCommands.explain,
            prompt: t.ai.slashCommands.explainPrompt,
        },
        {
            id: "default-fix",
            key: "fix",
            description: t.ai.slashCommands.fix,
            prompt: t.ai.slashCommands.fixPrompt,
        },
        {
            id: "default-translate",
            key: "translate",
            description: t.ai.slashCommands.translate,
            prompt: t.ai.slashCommands.translatePrompt,
        },
    ];
};

export const useCommandStore = create<CommandState>()(
    persist(
        (set) => ({
            commands: getDefaultCommands(),
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
