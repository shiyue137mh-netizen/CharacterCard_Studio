import chalk from "chalk";
import fs from "fs";
import path from "path";
import { IndexEntry, IndexFile } from "../types";
import { YamlParser } from "../utils/parser";

export class GeneratorService {
    static async generateEntries(
        prefix: string,
        count: number,
        templateName: string = "entry",
        targetDir: string = process.cwd()
    ) {
        // 1. Locate Template
        // In dev: src/templates/entry.yaml
        // In prod: dist/templates/entry.yaml (need to ensure build copies it, or inline it)
        // For simplicity, let's assume we read from a known location or inline default.

        let templateContent = "";
        try {
            // Try to find local template first? Or just use built-in defaults for now.
            // Using inline default to avoid path resolution issues in CLI for now.
            templateContent = `key: []\nkeysecondary: []\ncontent: | \n  ${prefix} content placeholder\n`;
        } catch (e) {
            // ignore
        }

        const entriesDir = path.join(targetDir, 'entries');
        if (!fs.existsSync(entriesDir)) {
            fs.mkdirSync(entriesDir, { recursive: true });
        }

        const newEntries: IndexEntry[] = [];

        // 2. Generate Files
        for (let i = 1; i <= count; i++) {
            const id = `${prefix}_${i}`;
            const fileName = `${id}.yaml`;
            const filePath = path.join(entriesDir, fileName);

            if (fs.existsSync(filePath)) {
                console.warn(chalk.yellow(`Skipping existing file: ${fileName}`));
                continue;
            }

            fs.writeFileSync(filePath, templateContent, 'utf-8');
            console.log(chalk.green(`Created: entries/${fileName}`));

            newEntries.push({
                id: id,
                comment: `Generated entry ${id}`,
                enabled: true,
                order: 100
            });
        }

        // 3. Update Index
        if (newEntries.length > 0) {
            const indexPath = path.join(targetDir, 'index.yaml');
            let indexData: IndexFile;

            if (fs.existsSync(indexPath)) {
                const existingIndex = fs.readFileSync(indexPath, 'utf-8');
                indexData = YamlParser.parseIndex(existingIndex);
            } else {
                indexData = { entries: [] };
            }

            if (!indexData.entries) indexData.entries = [];

            // Append new entries
            indexData.entries.push(...newEntries);

            fs.writeFileSync(indexPath, YamlParser.stringifyIndex(indexData), 'utf-8');
            console.log(chalk.green(`Updated index.yaml with ${newEntries.length} new entries.`));
        }
    }
}
