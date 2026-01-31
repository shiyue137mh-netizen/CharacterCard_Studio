import { Command } from "commander";
import { SyncService } from "../services/sync";
import chalk from "chalk";

export const PushCommand = new Command("push")
    .description("Push local changes to SillyTavern")
    .action(async () => {
        try {
            await SyncService.push(process.cwd());
        } catch (e: any) {
            console.error(chalk.red("Push failed:", e.message));
            if (e.response && e.response.data) {
                console.error(chalk.yellow("Response:", JSON.stringify(e.response.data)));
            }
            process.exit(1);
        }
    });
