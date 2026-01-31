import chalk from "chalk";
import { Command } from "commander";
import fs from "fs";
import path from "path";
import { GeneratorService } from "../services/generator";

export const GenCommand = new Command("gen")
    .description("Generate scaffold content")

GenCommand.command("entry")
    .description("Generate Worldbook entries")
    .option("-c, --count <number>", "Number of entries to generate", "1")
    .option("-p, --prefix <string>", "Prefix for entry IDs", "concept")
    .action(async (options) => {
        const projectPath = process.cwd();

        // Ensure we are in a Worldbook project
        if (!fs.existsSync(path.join(projectPath, 'index.yaml'))) {
            // Should we allow generating in empty folder and auto-init index?
            // For now, strict check.
            console.error(chalk.red("Error: Current directory is not a Worldbook project (no index.yaml found)."));
            return;
        }

        const count = parseInt(options.count, 10);
        if (isNaN(count) || count < 1) {
            console.error(chalk.red("Invalid count number."));
            return;
        }

        console.log(chalk.hex('#DA70D6')(`✨ Generating ${count} entries with prefix '${options.prefix}'...`));

        await GeneratorService.generateEntries(options.prefix, count, "entry", projectPath);
    });
