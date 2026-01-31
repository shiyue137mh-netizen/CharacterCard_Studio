import { Command } from "commander";
import { PullService, ProjectType } from "../services/pull";
import chalk from "chalk";
import path from "path";
import fs from "fs";

export const PullCommand = new Command("pull")
    .description("Pull Worldbook or Character from SillyTavern (Reverse Sync)")
    .option("-t, --type <type>", "Project type: 'worldbook' or 'character'")
    .action(async (options) => {
        try {
            const projectPath = process.cwd();
            const projectDirName = path.basename(projectPath);

            // Auto-detect type if not specified
            let type = options.type;
            if (!type) {
                if (fs.existsSync(path.join(projectPath, 'character.yaml'))) {
                    type = ProjectType.Character;
                } else if (fs.existsSync(path.join(projectPath, 'index.yaml'))) {
                    type = ProjectType.WorldBook;
                } else {
                    type = ProjectType.WorldBook; // Default
                }
            }

            console.log(chalk.yellow(`⚠️  Overwriting local files in ${projectPath} (Type: ${type})...`));

            if (type === ProjectType.Character) {
                await PullService.pullCharacter(projectDirName, projectPath);
            } else {
                await PullService.pullWorldBook(projectDirName, projectPath);
            }

        } catch (error: any) {
            console.error(chalk.red("Error pulling project:"), error.message);
            process.exit(1);
        }
    });
