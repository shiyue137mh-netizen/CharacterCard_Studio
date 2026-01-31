import chalk from 'chalk';
import type { WorldInfo } from '../types/index';
import { TavernAPI } from './tavern-api';

/**
 * Chat Message Interface
 */
export interface ChatMessage {
    name: string;
    is_user: boolean;
    mes: string;
    send_date?: string | number;
    extra?: Record<string, unknown>;
}

export class ChatApi {
    static async getSettings(): Promise<any> {
        return TavernAPI.fetch("/api/settings/get", { method: "POST" });
    }

    static async getWorldNames(): Promise<string[]> {
        const settings = await this.getSettings();
        return settings.world_names || [];
    }

    static async getChatList(avatarUrl: string): Promise<string[]> {
        const result = await TavernAPI.fetch<any[]>("/api/characters/chats", {
            method: "POST",
            body: JSON.stringify({ avatar_url: avatarUrl }),
        });
        return Array.isArray(result) ? result.map(item => item.file_name).filter(n => typeof n === 'string') : [];
    }

    static async getChat(avatarUrl: string, fileName: string): Promise<ChatMessage[]> {
        return TavernAPI.fetch<ChatMessage[]>("/api/chats/get", {
            method: "POST",
            body: JSON.stringify({ avatar_url: avatarUrl, file_name: fileName }),
        });
    }

    static async getCurrentChat(): Promise<{ character: string, messages: ChatMessage[] } | null> {
        // 1. Get Settings -> Active Character
        const settingsRes = await this.getSettings();
        let currentChar: string | undefined;

        if (typeof settingsRes.settings === 'string') {
            try {
                const inner = JSON.parse(settingsRes.settings);
                currentChar = inner.active_character || inner.character;
            } catch { }
        } else {
            currentChar = settingsRes.character;
        }

        if (!currentChar) return null;

        // 2. Get Chat List
        const chatList = await this.getChatList(currentChar);
        const displayCharName = currentChar.replace(/\.[^/.]+$/, "");

        if (!chatList || chatList.length === 0) {
            // Try default chat
            try {
                const defaultChat = await this.getChat(currentChar, displayCharName);
                if (defaultChat?.length > 0) return { character: displayCharName, messages: defaultChat };
            } catch { }
            return { character: displayCharName, messages: [] };
        }

        // 3. Get Latest Chat
        const latestChatFile = chatList[chatList.length - 1]; // logic: last is latest
        const cleanFileName = latestChatFile.replace(/\.jsonl$/, "");
        const messages = await this.getChat(currentChar, cleanFileName);

        return { character: displayCharName, messages };
    }

    static formatChatAsScript(messages: ChatMessage[]): string {
        if (!messages || messages.length === 0) return "*（No chat history）*";
        return messages
            .filter(m => m.mes)
            .map(m => {
                const speaker = m.is_user ? "👤 User" : `🎭 ${m.name}`;
                return `### ${speaker}\n${m.mes}\n`;
            })
            .join("\n");
    }
}

export class WorldBookReader {
    static async getByName(name: string): Promise<WorldInfo> {
        return TavernAPI.fetch<WorldInfo>("/api/worldinfo/get", {
            method: "POST",
            body: JSON.stringify({ name }),
        });
    }

    static async getAllWorldBooks(): Promise<string[]> {
        return ChatApi.getWorldNames();
    }
}

export class CharacterReader {
    static async getAll(): Promise<any[]> {
        return TavernAPI.fetch<any[]>("/api/characters/all", {
            method: "POST",
        });
    }

    static async getByName(name: string): Promise<any> {
        // Optimization: Try to guess filename = name + ".png" first
        // This avoids the heavy /api/characters/all call if the name matches the filename
        const candidates = [name, `${name}.png`];

        for (const candidate of candidates) {
            try {
                const char = await TavernAPI.fetch<any>("/api/characters/get", {
                    method: "POST",
                    body: JSON.stringify({ avatar_url: candidate }),
                });
                if (char && char.name) {
                    return char;
                }
            } catch (e) {
                // Ignore 400/404 errors during guessing
            }
        }

        // Fallback: Get all characters to find the filename by 'name' field
        console.warn(chalk.yellow(`Character "${name}" not found by filename, scanning all characters (this may be slow)...`));
        try {
            const all = await this.getAll();
            const match = all.find(c =>
                c.name === name ||
                c.avatar === name ||
                c.avatar === `${name}.png`
            );

            if (!match) return null;

            return TavernAPI.fetch<any>("/api/characters/get", {
                method: "POST",
                body: JSON.stringify({ avatar_url: match.avatar }),
            });
        } catch (e: any) {
            console.error(chalk.red(`Failed to scan all characters: ${e.message}`));
            return null;
        }
    }

    static async getAvatar(avatarUrl: string): Promise<ArrayBuffer> {
        return TavernAPI.fetchBinary("/api/characters/export", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                format: "png",
                avatar_url: avatarUrl
            }),
        });
    }
}
