import readline from 'node:readline';
import chalk from 'chalk';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export class InteractiveShell {
    private rl: readline.Interface;
    private server: McpServer;
    private port: number;

    constructor(server: McpServer, port: number) {
        this.server = server;
        this.port = port;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: chalk.cyan('CCS > ')
        });
    }

    start() {
        console.log(chalk.dim('Type "help" for available commands.'));
        this.rl.prompt();

        this.rl.on('line', (line) => {
            const input = line.trim();
            this.handleCommand(input);
            this.rl.prompt();
        }).on('close', () => {
            console.log('Exiting...');
            process.exit(0);
        });
    }

    private handleCommand(input: string) {
        const [cmd, ...args] = input.split(' ');

        switch (cmd.toLowerCase()) {
            case 'help':
            case '?':
                this.showHelp();
                break;
            case 'status':
                this.showStatus();
                break;
            case 'clear':
            case 'cls':
                console.clear();
                break;
            case 'exit':
            case 'quit':
                this.rl.close();
                break;
            case '':
                break;
            default:
                console.log(chalk.red(`Unknown command: ${cmd}`));
                console.log(chalk.dim('Type "help" for help.'));
                break;
        }
    }

    private showHelp() {
        console.log(chalk.yellow('\nAvailable Commands:'));
        console.log(`  ${chalk.green('status')}    - Show server status and tools`);
        console.log(`  ${chalk.green('help')}      - Show this help message`);
        console.log(`  ${chalk.green('clear')}     - Clear the terminal`);
        console.log(`  ${chalk.green('exit')}      - Stop the server`);
        console.log();
    }

    private showStatus() {
        console.log(chalk.yellow('\nServer Status:'));
        console.log(`  Port: ${chalk.green(this.port)}`);
        console.log(`  Mode: ${chalk.green('SSE (Interactive)')}`);
        console.log(`  Server Name: ${(this.server as any).serverInfo?.name || 'ccs-mcp'}`);
        console.log(`  Server Version: ${(this.server as any).serverInfo?.version || '1.0.0'}`);
        console.log();
    }
}
