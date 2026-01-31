import chalk from "chalk";
import { Command } from "commander";
import fs from "fs";
import ora from "ora";
import path from "path";
import { DiffEngine } from "../utils/diff-engine";

export const DiffCommand = new Command("diff")
    .description("Show changes between local and remote Worldbook")
    .argument("[entry]", "Specific entry ID to view diff for")
    .action(async (entryId) => {
        const projectPath = process.cwd();
        const projectDirName = path.basename(projectPath);

        const isWorldBook = fs.existsSync(path.join(projectPath, 'index.yaml'));
        const isCharacter = fs.existsSync(path.join(projectPath, 'character.yaml'));

        if (!isWorldBook && !isCharacter) {
            console.error(chalk.red("Current directory is not a CCS project (no index.yaml or character.yaml found)."));
            return;
        }

        const runDiff = async (path: string, name: string) => {
            const loader = ora(`Fetching comparison for ${name}...`).start();

            try {
                const diff = await DiffEngine.compareWorldBook(path, name);
                loader.stop();

                const modified = diff.modified;

                if (modified.length === 0) {
                    console.log(chalk.bold(`\n📚 WorldBook: ${name}`));
                    console.log(chalk.gray("   (No differences found)"));
                    return;
                }

                // Filter if argument provided
                const targetDiffs = entryId
                    ? modified.filter(m => m.id === entryId)
                    : modified;

                if (entryId && targetDiffs.length === 0) {
                    console.log(chalk.bold(`\n📚 WorldBook: ${name}`));
                    console.log(chalk.yellow(`   (No changes found for entry '${entryId}')`));
                    return;
                }

                console.log(chalk.bold(`\n📚 WorldBook: ${name}`));

                for (const item of targetDiffs) {
                    console.log(chalk.bold.blue(`Entry: ${item.id}`));
                    console.log(chalk.dim('----------------------------------------'));

                    item.diffs.forEach(part => {
                        // green for additions, red for deletions
                        // grey for common parts
                        const color = part.added ? chalk.green :
                            part.removed ? chalk.red : chalk.gray;

                        // Indent slightly
                        const lines = part.value.split('\n');
                        // Remove last empty split if any
                        if (lines[lines.length - 1] === '') lines.pop();

                        lines.forEach(line => {
                            const prefix = part.added ? '+ ' : part.removed ? '- ' : '  ';
                            console.log(color(`${prefix}${line}`));
                        });
                    });
                    console.log(chalk.dim('----------------------------------------\n'));
                }

            } catch (e: any) {
                loader.fail(`Error calculating diff for ${name}: ${e.message}`);
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
                        await runDiff(path.join(linkedDir, book), book);
                    }
                }
            } else {
                console.log(chalk.dim("   No linked worldbooks directory."));
            }
            return;
        }

        if (isWorldBook) {
            await runDiff(projectPath, projectDirName);
        }
    });
