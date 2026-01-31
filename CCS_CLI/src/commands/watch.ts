import { Command } from "commander";
import { FileWatcher } from "../services/watcher";
import chalk from "chalk";

export const watch = new Command("watch")
    .description("Watch for local changes and auto-push to SillyTavern")
    .argument("[path]", "Path to project root", ".")
    .action(async (projectPath) => {
        try {
            const watcher = new FileWatcher(projectPath);
            await watcher.start();
        } catch (error: any) {
            console.error(chalk.red("Error starting watcher:"), error.message);
            process.exit(1);
        }
    });
