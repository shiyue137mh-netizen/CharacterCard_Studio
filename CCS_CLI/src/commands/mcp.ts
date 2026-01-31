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
            console.error(chalk.blue('🐍 Starting CCS MCP Server...'));
        }

        const config = ConfigLoader.load();

        const server = new McpServer({
            name: "ccs-mcp",
            version: "1.0.0",
        });

        // Register Core Features
        registerReadTools(server);
        registerResources(server);

        // 1. Connection Status (Resource)
        server.resource(
            "status",
            "tavern://status",
            async (uri) => {
                return {
                    contents: [{
                        uri: uri.href,
                        text: JSON.stringify({
                            connected: true,
                            apiUrl: config.apiUrl,
                            mode: config.mode,
                            resources: [
                                "tavern://status",
                                "tavern://chat/current",
                                "tavern://worldbooks",
                                "tavern://characters"
                            ]
                        }, null, 2),
                        mimeType: "application/json"
                    }]
                };
            }
        );

        if (options.sse) {
            const app = express();
            const port = options.port ? parseInt(options.port) : 3000;

            let transport: SSEServerTransport | null = null;

            app.get("/sse", async (req, res) => {
                console.error(chalk.blue(`[SSE] Client connecting...`));
                transport = new SSEServerTransport("/messages", res);
                await server.connect(transport);
                console.error(chalk.green(`[SSE] Client connected and bound.`));
            });

            app.post("/messages", express.json(), async (req, res) => {
                console.error(chalk.magenta(`[POST] /messages received. Has transport: ${!!transport}`));
                if (transport) {
                    try {
                        await transport.handlePostMessage(req, res);
                        console.error(chalk.dim(`[POST] /messages handled.`));
                    } catch (e) {
                        console.error(chalk.red(`[POST] /messages error: ${e}`));
                    }
                } else {
                    console.error(chalk.red(`[POST] /messages failed: No transport.`));
                    res.status(500).send("No transport");
                }
            });

            app.listen(port, () => {
                console.error(chalk.green(`✅ MCP Server running in SSE mode on port ${port}`));
                const shell = new InteractiveShell(server, port);
                shell.start();
            });
        } else {
            const transport = new StdioServerTransport();
            await server.connect(transport);
        }
    }
}
