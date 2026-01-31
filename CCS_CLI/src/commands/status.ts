import chalk from "chalk";
import { Command } from "commander";
import fs from "fs";
import ora from "ora";
import path from "path";
import { DiffEngine } from "../utils/diff-engine";

export const StatusCommand = new Command("status")
    .description("Show the working tree status")
    .action(async () => {
        const projectPath = process.cwd();
        const projectDirName = path.basename(projectPath);

        // check project type
        const isWorldBook = fs.existsSync(path.join(projectPath, 'index.yaml'));
        const isCharacter = fs.existsSync(path.join(projectPath, 'character.yaml'));

        if (!isWorldBook && !isCharacter) {
            console.error(chalk.red("Current directory is not a CCS project (no index.yaml or character.yaml found)."));
            return;
        }

        const runStatus = async (path: string, name: string) => {
            const loader = ora(`Checking ${name}...`).start();
            try {
                const diff = await DiffEngine.compareWorldBook(path, name);
                loader.stop();

                console.log(chalk.bold(`\n📚 WorldBook: ${name}`));

                if (diff.localOnly.length === 0 && diff.remoteOnly.length === 0 && diff.modified.length === 0) {
                    console.log(chalk.dim("   (No changes)"));
                    return;
                }

                if (diff.localOnly.length > 0) {
                    diff.localOnly.forEach(id => console.log(chalk.green(`  [+] ${id}`)));
                }

                if (diff.modified.length > 0) {
                    diff.modified.forEach(m => console.log(chalk.yellow(`  [~] ${m.id}`)));
                }

                if (diff.remoteOnly.length > 0) {
                    diff.remoteOnly.forEach(id => console.log(chalk.red(`  [-] ${id}`)));
                }
            } catch (e: any) {
                loader.fail(`Error checking ${name}: ${e.message}`);
            }
        };

        if (isCharacter) {
            console.log(chalk.blue(`👤 Character Project: ${projectDirName}`));

            const linkedDir = path.join(projectPath, 'linked_worldbooks');
            if (fs.existsSync(linkedDir)) {
                const books = fs.readdirSync(linkedDir).filter(f => fs.statSync(path.join(linkedDir, f)).isDirectory());
                if (books.length === 0) {
                    console.log(chalk.dim("   No linked worldbooks found."));
                } else {
                    for (const book of books) {
                        await runStatus(path.join(linkedDir, book), book);
                    }
                }
            } else {
                console.log(chalk.dim("   No linked worldbooks directory."));
            }
            return;
        }

        if (isWorldBook) {
            await runStatus(projectPath, projectDirName);
        }
    });
