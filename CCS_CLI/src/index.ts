import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { InitCommand } from './commands/init.js';
import { Sidebar } from './commands/mcp.js';

import { CloneCommand } from './commands/clone.js';
import { DiffCommand } from './commands/diff.js';
import { GenCommand } from './commands/gen.js';
import { PullCommand } from './commands/pull.js';
import { PushCommand } from './commands/push.js';
import { StatusCommand } from './commands/status.js';
import { watch } from './commands/watch.js';

// Get package version
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let pkgVersion = '0.0.0';
try {
    const pkgPath = path.resolve(__dirname, '../package.json');
    if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        pkgVersion = pkg.version;
    }
} catch (e) {
    // ignore
}

const program = new Command();

program
    .name('st')
    .description('CharacterCard Studio CLI - Unified Tool for SillyTavern')
    .version(pkgVersion)
    .hook('preAction', (thisCommand) => {
        // Only show banner for root command or specific commands if needed
        // For now, show it always except for 'mcp' potentially, or just show it.
        // But 'mcp' is stdio, so we MUST NOT output anything to stdout unless it's logging.
        // Actually, for MCP stdio, we must be careful.
        if (thisCommand.name() !== 'mcp') {
        }
    });

program.addCommand(InitCommand);
program.addCommand(PushCommand);
program.addCommand(PullCommand);
program.addCommand(CloneCommand);
program.addCommand(StatusCommand);
program.addCommand(DiffCommand);
program.addCommand(GenCommand);
program.addCommand(watch);

program.command('mcp')
    .description('Start the MCP Server (Stdio or SSE mode)')
    .option('--sse', 'Run in SSE mode (HTTP Server)')
    .option('--port <number>', 'Port for SSE server', '3000')
    .action(async (options) => {
        await Sidebar.start(options);
    });

program.parse();
