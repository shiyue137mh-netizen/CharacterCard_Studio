import chokidar from "chokidar";
import chalk from "chalk";
import path from "path";
import { SyncService } from "./sync";

export class FileWatcher {
    private watcher: ReturnType<typeof chokidar.watch> | null = null;
    private isPushing = false;
    private pushQueue = false;

    private rootPath: string;

    constructor(rootPath: string) {
        this.rootPath = rootPath;
    }

    async start() {
        const fullPath = path.resolve(this.rootPath);
        console.log(chalk.cyan(`👀 Watching for changes in ${fullPath}...`));

        const entriesPath = path.join(fullPath, "entries");
        const indexPath = path.join(fullPath, "index.yaml");

        console.log(chalk.dim(`  - ${entriesPath}`));
        console.log(chalk.dim(`  - ${indexPath}`));

        // Watch entries directory recursively and index.yaml
        this.watcher = chokidar.watch([
            entriesPath,
            indexPath
        ], {
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 500,
                pollInterval: 100
            }
        });

        // Listen for ready event
        this.watcher.on('ready', () => {
            console.log(chalk.green('✅ Watcher is ready.'));
        });

        this.watcher.on("all", (event: string, filePath: string) => {
            console.log(chalk.dim(`📄 Detected change [${event}]: ${filePath}`));
            this.triggerPush();
        });

        // Handle process termination to close watcher gracefully
        process.on('SIGINT', () => {
            this.stop().then(() => process.exit(0));
        });
    }

    private async triggerPush() {
        if (this.isPushing) {
            this.pushQueue = true;
            return;
        }

        this.isPushing = true;

        try {
            console.log(chalk.yellow("🔄 Syncing changes..."));
            await SyncService.push(this.rootPath);
            console.log(chalk.green("✅ Synced!"));
        } catch (error: any) {
            console.error(chalk.red(`❌ Sync failed: ${error.message}`));
        } finally {
            this.isPushing = false;
            if (this.pushQueue) {
                this.pushQueue = false;
                this.triggerPush();
            }
        }
    }

    async stop() {
        if (this.watcher) {
            console.log(chalk.yellow("\n🛑 Stopping watcher..."));
            await this.watcher.close();
            this.watcher = null;
        }
    }
}
