import chalk from "chalk";
import { Command } from "commander";
import fs from "fs";
import ora from "ora";
import path from "path";
import { CharacterReader, WorldBookReader } from "../api/api-wrappers";
import { ConfigLoader } from "../services/config";
import { ProjectType, PullService } from "../services/pull";

export const CloneCommand = new Command("clone")
    .description("Clone a Worldbook or Character from SillyTavern")
    .argument("[name]", "Name of the Worldbook/Character to clone")
    .option("-t, --type <type>", "Project type: 'worldbook' or 'character'")
    .action(async (name, options) => {
        try {
            // Interactive Mode if name is missing
            if (!name) {
                // Dynamic import for inquirer (ESM)
                const inquirer = (await import('inquirer')).default;

                // 1. Select Type
                const typeAnswer = await inquirer.prompt([{
                    type: 'list',
                    name: 'type',
                    message: 'What do you want to clone?',
                    choices: [
                        { name: 'Worldbook', value: ProjectType.WorldBook },
                        { name: 'Character', value: ProjectType.Character }
                    ],
                    default: options.type || ProjectType.WorldBook
                }]);
                options.type = typeAnswer.type;

                // 2. Select Item
                let choices: string[] = [];
                const loader = ora('Fetching list...').start();

                try {
                    if (options.type === ProjectType.Character) {
                        const chars = await CharacterReader.getAll();
                        choices = chars.map(c => c.name || "Unknown");
                    } else {
                        choices = await WorldBookReader.getAllWorldBooks();
                    }
                    loader.stop();
                } catch (e) {
                    loader.fail('Failed to fetch list.');
                    process.exit(1);
                }

                if (choices.length === 0) {
                    console.log(chalk.hex('#FFA500')(`No ${options.type}s found on server.`));
                    process.exit(0);
                }

                const nameAnswer = await inquirer.prompt([{
                    type: 'list',
                    name: 'name',
                    message: `Select ${options.type}:`,
                    choices: choices,
                    loop: false,
                    pageSize: 20
                }]);
                name = nameAnswer.name;
            }

            // Normal Execution
            let targetDir = path.resolve(process.cwd(), name);
            const type = (options.type || ProjectType.WorldBook) as ProjectType;

            // Strip extension from directory name (e.g. 'Seraphina.png' -> 'Seraphina')
            const safeName = path.basename(name, path.extname(name));

            // [NEW] Use 'Characters' subdirectory for characters
            if (type === ProjectType.Character) {
                targetDir = path.resolve(process.cwd(), 'Characters', safeName);
            } else if (type === ProjectType.WorldBook) {
                targetDir = path.resolve(process.cwd(), 'Worldbooks', safeName);
            } else {
                targetDir = path.resolve(process.cwd(), safeName);
            }

            if (fs.existsSync(targetDir)) {
                console.error(chalk.red(`Directory ${targetDir} already exists.`));
                process.exit(1);
            }

            // 3. Perform Pull (This will create files)
            const loader = ora(`Pulling ${type === ProjectType.Character ? 'Character' : 'Worldbook'} "${name}"...`).start();
            try {
                if (type === ProjectType.Character) {
                    await PullService.pullCharacter(name, targetDir);
                } else {
                    await PullService.pullWorldBook(name, targetDir);
                }
                loader.succeed(`Successfully cloned ${type} "${name}"!`);
            } catch (e: any) {
                loader.fail(`Error cloning project: ${e.message}`);
                // Cleanup if directory was created and empty/partial?
                // Actually PullService creates the directory if not exists?
                // Wait, if PullService fails, we might have a partial directory.
                // But check logic: we passed targetDir.
                // Let's rely on PullService or manual cleanup.
                if (fs.existsSync(targetDir)) {
                    // Check if empty or just created
                    // For safety, maybe just leave it or ask user?
                    // For now, let's remove it if it was just created
                    // But we need to know if WE created it.
                    // The safe way is: verify existence BEFORE creating.
                    // PullService takes 'targetDir'.
                    // Let's modify PullService to create dir?
                    // Or just do:
                    try {
                        // Simple cleanup if empty or only config files
                        // fs.rmdirSync(targetDir, { recursive: true });
                    } catch { }
                }
                process.exit(1);
            }

            // Create config AFTER success (if PullService didn't fail)
            // But wait, we usually want config BEFORE? No, after is fine.

            // Re-verify dir exists (PullService should have used it)
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            // Create minimal config
            const globalConfig = ConfigLoader.loadGlobal();
            const configLines = [`project_type: "${type}"`];

            if (!globalConfig.apiUrl) {
                configLines.push(`api_url: "http://127.0.0.1:8000"`);
            } else {
                console.log(chalk.dim(`   Using Global API URL: ${globalConfig.apiUrl}`));
            }

            // ... keys ...

            const configPath = path.join(targetDir, 'sillytavern.config.yaml');
            fs.writeFileSync(configPath, configLines.join('\n'));

            const relativePath = path.relative(process.cwd(), targetDir);
            console.log(chalk.hex('#FF69B4')(`\n✨ Successfully cloned ${type} "${name}"!`));
            console.log(chalk.dim(`   cd ${relativePath}`));
            console.log(chalk.dim(`   st watch`));

        } catch (error: any) {
            console.error(chalk.red("Error cloning project:"), error.message);
            process.exit(1);
        }
    });
