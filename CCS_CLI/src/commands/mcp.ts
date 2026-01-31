import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import chalk from "chalk";
import express from "express";
import { registerResources } from '../mcp/resources';
import { registerReadTools } from '../mcp/tools';
import { ConfigLoader } from '../services/config';
import { showBanner } from '../ui/banner';
import { InteractiveShell } from '../ui/shell';

export class Sidebar {
    static async start(options: { sse?: boolean, port?: string } = {}) {
        if (options.sse) {
            showBanner();
            console.error(chalk.blue('🐍 Starting CCS MCP Server (God Mode)...'));
        }

        const config = ConfigLoader.load();

        const server = new McpServer({
            name: "ccs-mcp",
            version: "1.0.0",
        });

        // Register Core Features
        registerReadTools(server);
        registerResources(server);

        // Status Resource
        server.resource(
            "status",
            "tavern://status",
            async (uri) => {
                return {
                    contents: [{
                        uri: uri.href,
                        text: JSON.stringify({
                            connected: true,
                            mode: "god-mode",
                            apiUrl: config.apiUrl
                        }, null, 2),
                        mimeType: "application/json"
                    }]
                };
            }
        );

        if (options.sse) {
            const app = express();
            const port = options.port ? parseInt(options.port) : 3000;

            // 全局单例 Transport
            let activeTransport: SSEServerTransport | null = null;

            app.get("/sse", async (req, res) => {
                console.error(chalk.blue(`[SSE] New connection incoming...`));

                // 1. 强制创建新 Transport
                activeTransport = new SSEServerTransport("/messages", res);

                try {
                    console.error(chalk.blue(`[SSE] Active Session ID: ${activeTransport.sessionId}`));
                    await server.connect(activeTransport);
                    console.error(chalk.green(`[SSE] Connected!`));
                } catch (err) {
                    console.error(chalk.red(`[SSE] Connect error: ${err}`));
                }
            });

            app.post("/messages", express.json(), async (req, res) => {
                if (activeTransport) {
                    try {
                        // 🔓 GOD MODE HACK: 核心修复
                        // SDK 内部会校验 req.query.sessionId。
                        // 如果客户端发来的 ID (req.query.sessionId) 和服务器当前 ID (activeTransport.sessionId) 不一致，SDK 会报错 400。
                        // 这里我们"强行"把请求里的 ID 改成服务器当前的 ID，欺骗 SDK 让它放行。
                        req.query.sessionId = activeTransport.sessionId;

                        await activeTransport.handlePostMessage(req, res);
                    } catch (e) {
                        console.error(chalk.red(`[POST] Error: ${e}`));
                        // 即使报错也不要断开，尝试返回 500 让客户端重试
                        if (!res.headersSent) res.status(500).send(String(e));
                    }
                } else {
                    console.error(chalk.red(`[POST] Failed: No active transport.`));
                    res.status(503).send("Server initializing");
                }
            });

            const httpServer = app.listen(port, () => {
                console.error(chalk.green(`✅ Server ready on port ${port}`));
                const shell = new InteractiveShell(server, port);
                shell.start();
            });

            // 🔥 解决 EOF 问题：禁用所有超时
            httpServer.setTimeout(0);
            httpServer.keepAliveTimeout = 0;
            // Headers 里的 Keep-Alive 也很重要
            httpServer.headersTimeout = 0;

        } else {
            const transport = new StdioServerTransport();
            await server.connect(transport);
        }
    }
}
