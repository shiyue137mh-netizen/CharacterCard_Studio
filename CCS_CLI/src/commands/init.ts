import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import type { CCSConfig } from '../types/index';

class ProjectInitLogic {
    static async run(name: string) {
        console.log(chalk.cyan(`🚀 Initializing new CCS project: ${name}`));

        const targetDir = path.resolve(process.cwd(), name);

        if (fs.existsSync(targetDir)) {
            console.error(chalk.red(`❌ Directory ${name} already exists!`));
            return;
        }

        const answers = await inquirer.prompt([
            {
                type: 'list',
                name: 'mode',
                message: 'Select project mode:',
                choices: [
                    { name: 'Worldbook Project (Collection of entries)', value: 'worldbook' },
                    { name: 'Character Project (Monorepo)', value: 'character' }
                ]
            },
            {
                type: 'input',
                name: 'apiUrl',
                message: 'SillyTavern API URL:',
                default: 'http://127.0.0.1:8000'
            }
        ]);

        // Create directory structure
        fs.mkdirSync(targetDir, { recursive: true });

        if (answers.mode === 'worldbook') {
            fs.mkdirSync(path.join(targetDir, 'entries'));

            // Create index.yaml
            fs.writeFileSync(path.join(targetDir, 'index.yaml'),
                `# Worldbook Index
# Define the order and structure of your entries here.
# CCS will use this to generate the final JSON.

entries:
  - name: "Example Entry"
    path: "entries/example.yaml"
`);

            // Create example entry
            fs.writeFileSync(path.join(targetDir, 'entries/example.yaml'),
                `name: Example Entry
keys: [example, demo]
content: |
  This is an example worldbook entry.
`);
        } else {
            // Character mode scaffolding
            fs.mkdirSync(path.join(targetDir, 'assets'));
            fs.mkdirSync(path.join(targetDir, 'linked_worldbooks'));
            fs.writeFileSync(path.join(targetDir, 'character.yaml'), 'name: ' + name);
        }

        // Create sillytavern.config.yaml
        const config: CCSConfig = {
            apiUrl: answers.apiUrl,
            mode: answers.mode
        };

        fs.writeFileSync(
            path.join(targetDir, 'sillytavern.config.yaml'),
            yaml.dump(config)
        );

        console.log(chalk.green(`\n✅ Project ${name} created successfully!`));
        console.log(chalk.white(`\nNext steps:`));
        console.log(chalk.gray(`  cd ${name}`));
        console.log(chalk.gray(`  st push`));
    }
}

export const InitCommand = new Command("init")
    .description("Initialize a new CCS project")
    .argument('<name>', 'Project name')
    .action(async (name) => {
        await ProjectInitLogic.run(name);
    });
