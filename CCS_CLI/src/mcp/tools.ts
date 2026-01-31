import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import chalk from "chalk";
import ora from "ora";
import { z } from "zod";
import { CharacterReader, ChatApi, WorldBookReader } from "../api/api-wrappers";
import { sanitizeCharacterData } from "../utils/security";

/*
 * Note: Input validation is strengthened to prevent DOS and Resource Exhaustion.
 *       Character data is sanitized to prevent leaking system paths and private metadata.
 */


export function registerReadTools(server: McpServer) {
    // 1. Search Tool
    server.tool(
        "search_worldinfo",
        "Search worldbook entries by keyword in key, name, or content.",
        {
            query: z.string().min(1).max(100).describe("Search keyword (max 100 chars)"),
            book: z.string().regex(/^[a-zA-Z0-9_\-\.\s]+$/, "Invalid book name").optional().describe("Limit search to specific Worldbook name"),
            limit: z.number().min(1).max(100).optional().default(20).describe("Max results (1-100)"),
        },
        async ({ query, book, limit }) => {
            const results: any[] = [];
            const booksToSearch = book ? [book] : await WorldBookReader.getAllWorldBooks();
            const lowerQuery = query.toLowerCase();

            const spinner = ora(chalk.cyan(`🔍 [MCP] Searching WorldBooks for: "${query}"...`)).start();
            if (book) spinner.text += chalk.dim(` (In book: ${book})`);

            for (const bookName of booksToSearch) {
                if (results.length >= limit) break;

                // 0. Book Name Match
                if (bookName.toLowerCase().includes(lowerQuery)) {
                    results.push({
                        book: bookName,
                        id: "METADATA",
                        name: bookName,
                        matchType: "FILE_NAME",
                        snippet: "The Worldbook name matches the query."
                    });
                }

                try {
                    const data = await WorldBookReader.getByName(bookName);
                    if (!data.entries) continue;

                    for (const [id, entry] of Object.entries(data.entries)) {
                        let matchType = "";
                        let snippet = "";

                        // Key Match
                        const keyMatch = entry.key?.find(k => k.toLowerCase().includes(lowerQuery));
                        if (keyMatch) {
                            matchType = "key";
                            snippet = `Key: ${keyMatch}`;
                        }
                        // Name Match
                        else if (entry.comment?.toLowerCase().includes(lowerQuery)) {
                            matchType = "name";
                            snippet = `Name: ${entry.comment}`;
                        }
                        // Content Match
                        else if (entry.content?.toLowerCase().includes(lowerQuery)) {
                            matchType = "content";
                            const idx = entry.content.toLowerCase().indexOf(lowerQuery);
                            const start = Math.max(0, idx - 30);
                            const end = Math.min(entry.content.length, idx + query.length + 30);
                            snippet = `...${entry.content.slice(start, end)}...`;
                        }

                        if (matchType) {
                            results.push({
                                book: bookName,
                                id,
                                name: entry.comment || "(No Name)",
                                matchType,
                                snippet
                            });
                            if (results.length >= limit) break;
                        }
                    }
                } catch (e) {
                    // ignore error per book
                }
            }

            spinner.succeed(chalk.green(`Search completed. Found ${results.length} matches.`));

            if (results.length === 0) {
                return { content: [{ type: "text", text: `No matches found for "${query}"` }] };
            }

            const text = results.map(r =>
                `[${r.book}] ${r.name} (ID: ${r.id})\n   Match: ${r.matchType}\n   ${r.snippet}`
            ).join("\n\n");

            return {
                content: [{ type: "text", text: `Found ${results.length} matches:\n\n${text}` }]
            };
        }
    );

    // 2. Inspect Tool
    server.tool(
        "get_worldbook_details",
        "Get full entry list of a Worldbook.",
        {
            book: z.string().regex(/^[a-zA-Z0-9_\-\.\s]+$/, "Invalid book name").describe("Worldbook Name"),
        },
        async ({ book }) => {
            try {
                const data = await WorldBookReader.getByName(book);
                if (!data.entries) throw new Error("No entries found");

                // Simple summary
                const summary = Object.entries(data.entries).map(([id, e]) =>
                    `- [${id}] ${e.comment || 'No Name'} (Keys: ${e.key?.join(', ')})`
                ).join("\n");

                return {
                    content: [{ type: "text", text: `# ${book}\n\n${summary}` }]
                };
            } catch (error: any) {
                return {
                    content: [{ type: "text", text: `Error: ${error.message}` }],
                    isError: true
                };
            }
        }
    );

    // 3. Search Characters
    server.tool(
        "search_characters",
        "Search for characters by name or tag.",
        {
            query: z.string().min(1).max(100).describe("Search query (name or tag)"),
        },
        async ({ query }) => {
            try {
                const all = await CharacterReader.getAll();
                const q = query.toLowerCase();
                const matches = all.filter(c =>
                    c.name?.toLowerCase().includes(q) ||
                    (Array.isArray(c.tags) && c.tags.some((t: any) => String(t).toLowerCase().includes(q)))
                );

                if (matches.length === 0) {
                    return { content: [{ type: "text", text: `No characters found matching "${query}"` }] };
                }

                const summary = matches.map(c => `- ${c.name} (File: ${c.avatar})`).join("\n");
                return {
                    content: [{ type: "text", text: `Found ${matches.length} characters:\n\n${summary}` }]
                };
            } catch (error: any) {
                return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
            }
        }
    );

    // 4. Get Character Details
    server.tool(
        "get_character_details",
        "Get detailed metadata for a specific Character.",
        {
            name: z.string().describe("Name of the character"),
        },
        async ({ name }) => {
            try {
                const char = await CharacterReader.getByName(name);
                if (!char) {
                    return { content: [{ type: "text", text: "Character not found." }], isError: true };
                }
                const safeChar = sanitizeCharacterData(char);
                return {
                    content: [{ type: "text", text: JSON.stringify(safeChar, null, 2) }]
                };
            } catch (error: any) {
                return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
            }
        }
    );

    // 5. Get Current Chat
    server.tool(
        "get_current_chat",
        "Get the chat history of the currently active character in SillyTavern. Useful for understanding context.",
        {
            limit: z.number().optional().describe("Limit number of messages (default 20)"),
        },
        async ({ limit = 20 }) => {
            try {
                const result = await ChatApi.getCurrentChat();

                if (!result) {
                    return {
                        content: [{
                            type: "text",
                            text: "Unable to get current chat: No active character or chat history found."
                        }],
                        isError: true
                    };
                }

                const { character, messages } = result;

                // Slice last N messages
                const slicedMessages = messages.slice(-limit);
                const script = ChatApi.formatChatAsScript(slicedMessages);

                return {
                    content: [{
                        type: "text",
                        text: `# Current Chat: ${character}\n\n${script}`
                    }]
                };

            } catch (error: any) {
                return {
                    content: [{
                        type: "text",
                        text: `Failed to get chat history: ${error.message}`
                    }],
                    isError: true
                };
            }
        }
    );
}
