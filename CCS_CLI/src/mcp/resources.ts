import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ChatApi, WorldBookReader, CharacterReader } from "../api/api-wrappers";

export function registerResources(server: McpServer) {
    // 1. Current Chat Resource
    server.resource(
        "current_chat",
        "tavern://chat/current",
        async (uri) => {
            try {
                const result = await ChatApi.getCurrentChat();
                if (!result) {
                    return {
                        contents: [{
                            uri: uri.href,
                            text: "(No active chat found)",
                            mimeType: "text/plain"
                        }]
                    };
                }
                const script = ChatApi.formatChatAsScript(result.messages);
                return {
                    contents: [{
                        uri: uri.href,
                        text: `# Chat with ${result.character}\n\n${script}`,
                        mimeType: "text/plain" // Or markdown?
                    }]
                };
            } catch (e: any) {
                return {
                    contents: [{
                        uri: uri.href,
                        text: `Error: ${e.message}`,
                        mimeType: "text/plain"
                    }]
                };
            }
        }
    );

    // 2. Worldbook List Resource
    server.resource(
        "worldbook_list",
        "tavern://worldbooks",
        async (uri) => {
            const names = await WorldBookReader.getAllWorldBooks();
            return {
                contents: [{
                    uri: uri.href,
                    text: names.join("\n"),
                    mimeType: "text/plain"
                }]
            };
        }
    );

    // 3. Character List Resource
    server.resource(
        "character_list",
        "tavern://characters",
        async (uri) => {
            try {
                const chars = await CharacterReader.getAll();
                const list = chars.map(c => `- ${c.name} (${c.avatar})`).join("\n");
                return {
                    contents: [{
                        uri: uri.href,
                        text: list,
                        mimeType: "text/plain"
                    }]
                };
            } catch (e: any) {
                return {
                    contents: [{
                        uri: uri.href,
                        text: `Error: ${e.message}`,
                        mimeType: "text/plain"
                    }]
                };
            }
        }
    );
}
