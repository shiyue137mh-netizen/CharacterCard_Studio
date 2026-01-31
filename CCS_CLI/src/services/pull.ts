import chalk from 'chalk';
import yaml from 'js-yaml';
import fs from 'node:fs';
import path from 'node:path';
import { CharacterReader, WorldBookReader } from '../api/api-wrappers';
import type { ContentFile, IndexEntry, IndexFile, WorldInfoEntry } from '../types/index';
import { CharacterSchema, WorldInfoEntrySchema } from '../types/schemas';
import { UI } from '../ui/progress';
import { FileUtils } from '../utils/file-utils';
import { YamlParser } from '../utils/parser';
import { ValidationUtils } from '../utils/validator';

export const ProjectType = {
    WorldBook: 'worldbook',
    Character: 'character'
} as const;
export type ProjectType = typeof ProjectType[keyof typeof ProjectType];

/**
 * Handles "Pull" operations (Remote -> Local)
 */
export class PullService {

    /**
     * Save Worldbook data to local directory structure (entries/ + index.yaml)
     */
    private static async saveWorldBookLocal(worldInfo: any, targetDir: string) {
        // 1. Prepare Directories
        const entriesDir = path.join(targetDir, 'entries');
        if (!fs.existsSync(entriesDir)) {
            fs.mkdirSync(entriesDir, { recursive: true });
        }

        // 2. Process Entries
        // 2. Process Entries
        // 2. Process Entries
        const entryMap = worldInfo.entries;
        const entriesArray: WorldInfoEntry[] = [];
        let rawEntries: any[] = [];

        if (Array.isArray(entryMap)) {
            rawEntries = entryMap;
        } else {
            rawEntries = Object.values(entryMap);
        }

        for (let i = 0; i < rawEntries.length; i++) {
            const rawEntry = rawEntries[i];
            const entryLabel = `Remote Entry ${rawEntry.uid || i}`;

            // Normalize keys (handle legacy V1 / embedded format)
            if ((!rawEntry.key || rawEntry.key.length === 0) && rawEntry.keys) {
                rawEntry.key = rawEntry.keys;
            }

            if ((!rawEntry.keysecondary || rawEntry.keysecondary.length === 0) && rawEntry.secondary_keys) {
                rawEntry.keysecondary = rawEntry.secondary_keys;
            }

            const validated = ValidationUtils.validate(WorldInfoEntrySchema, rawEntry as any, entryLabel);
            if (validated) {
                entriesArray.push(validated);
            }
        }

        // Sort by order, then by UID to ensure stability
        entriesArray.sort((a, b) => {
            if ((a.order || 0) !== (b.order || 0)) {
                return (a.order || 0) - (b.order || 0);
            }
            return Number(a.uid) - Number(b.uid);
        });

        console.log(chalk.dim(`   Found ${entriesArray.length} entries.`));
        const progressBar = UI.createProgressBar(entriesArray.length);

        const indexEntries: IndexEntry[] = [];
        let savedCount = 0;

        for (const entry of entriesArray) {
            // Generate ID (FileName)
            let safeName = (entry.comment || `entry_${entry.uid}`)
                .replace(/[^a-z0-9\u4e00-\u9fa5_\-\.]/gi, '_')
                .replace(/_{2,}/g, '_');

            if (!safeName) safeName = `entry_${entry.uid}`;

            // Ensure uniqueness
            let fileName = safeName; // No extension for ID
            let counter = 1;
            while (indexEntries.some(e => e.id === fileName)) {
                fileName = `${safeName}_${counter}`; // Start with _1, _2
                counter++;
            }
            const finalId = fileName;

            // 1. Create Content File
            // User Request: Force key present, remove keysecondary
            const contentFile: ContentFile = {
                key: entry.key || [], // Always array
                keysecondary: [],     // Always empty/removed in output due to parser change
                content: entry.content || "",
            };

            // ... (imports)

            const yamlContent = YamlParser.stringifyContent(contentFile);

            // Smart Save: Check if file already exists recursively to preserve folder structure
            const existingPath = FileUtils.findEntryFile(entriesDir, finalId);
            const targetPath = existingPath || path.join(entriesDir, `${finalId}.yaml`);

            fs.writeFileSync(targetPath, yamlContent, 'utf-8');

            // 2. Create Index Entry
            // Default clean object
            const indexEntry: Partial<IndexEntry> = {
                id: finalId,
                // Only keep comment if it's different from ID (e.g. lost special chars)
                comment: (entry.comment && entry.comment !== finalId) ? entry.comment : undefined,
                enabled: !entry.disable,
                constant: entry.constant,
                position: entry.position,
                order: entry.order,
                depth: entry.depth,
            };

            // Optional fields only if defined/non-default
            if (entry.probability !== 100) indexEntry.probability = entry.probability;
            if (entry.group) indexEntry.group = entry.group;
            if (entry.selective === false) indexEntry.selective = false; // logic: defaulted to true usually?
            if (entry.role !== null && entry.role !== undefined) indexEntry.role = entry.role;
            if (entry.sticky !== null && entry.sticky !== 0) indexEntry.sticky = entry.sticky;
            if (entry.cooldown !== null && entry.cooldown !== 0) indexEntry.cooldown = entry.cooldown;
            if (entry.delay !== null && entry.delay !== 0) indexEntry.delay = entry.delay;
            if (entry.excludeRecursion) indexEntry.excludeRecursion = true;
            if (entry.preventRecursion) indexEntry.preventRecursion = true;
            if (entry.delayUntilRecursion) indexEntry.delayUntilRecursion = true;
            if (entry.matchWholeWords) indexEntry.matchWholeWords = true;
            if (entry.caseSensitive) indexEntry.caseSensitive = true;
            if (entry.useGroupScoring) indexEntry.useGroupScoring = true;
            if (entry.automationId) indexEntry.automationId = entry.automationId;

            // Remove undefined/default values to keep index clean?
            // For now, let YamlParser or just raw dump handle it.
            // Better to only keep defined values.

            indexEntries.push(indexEntry as IndexEntry);
            savedCount++;
            progressBar.increment();
        }

        // 3. Cleanup: Delete orphaned files (Remote deletion -> Local deletion)
        // Scan directory for .yaml files that weren't just touched/created
        const writtenFiles = new Set(indexEntries.map(e => `${e.id}.yaml`));
        try {
            const allFiles = fs.readdirSync(entriesDir);
            for (const file of allFiles) {
                if (file.endsWith('.yaml') || file.endsWith('.yml')) {
                    // Check if normalized ID matches (handles .yaml vs .yml if we were rigorous, but for now exact match)
                    // If file is NOT in writtenFiles, delete it.
                    // Note: index.yaml is in parent, so we only checking entries/*
                    if (!writtenFiles.has(file) && !writtenFiles.has(file.replace('.yml', '.yaml'))) {
                        console.log(chalk.red(`   🗑️  Deleting orphaned file: ${file}`));
                        fs.unlinkSync(path.join(entriesDir, file));
                    }
                }
            }
        } catch (e) {
            console.warn(chalk.yellow(`   Warning: Failed to cleanup orphaned files: ${e}`));
        }

        UI.stopAll();

        // 3. Generate index.yaml
        const indexData: IndexFile = {
            book_name: worldInfo.name,
            global_settings: { recursive: true },
            entries: indexEntries
        };

        const indexContent = YamlParser.stringifyIndex(indexData);
        fs.writeFileSync(path.join(targetDir, 'index.yaml'), indexContent, 'utf-8');

        return savedCount;
    }

    /**
     * Pull a Worldbook from SillyTavern and save it locally
     * @param worldBookName Name of the Worldbook to pull
     * @param targetDir Directory to initialize/update (default: current dir)
     */
    static async pullWorldBook(worldBookName: string, targetDir: string = process.cwd()) {
        UI.startSpinner(`Pulling Worldbook "${worldBookName}"...`);

        // 1. Fetch from API
        const worldInfo = await WorldBookReader.getByName(worldBookName);
        if (!worldInfo || !worldInfo.entries) {
            throw new Error(`Worldbook "${worldBookName}" not found or empty.`);
        }

        // 2. Save locally
        UI.succeedSpinner('Worldbook data fetched. Saving files...');
        const savedCount = await this.saveWorldBookLocal(worldInfo, targetDir);
        console.log(chalk.green(`✅ Pulled ${savedCount} entries to "${targetDir}"`));
    }

    /**
     * Pull a Character from SillyTavern and save it locally
     * @param charName Name of the Character to pull
     * @param targetDir Directory to initialize/update (default: current dir)
     */
    static async pullCharacter(charName: string, targetDir: string = process.cwd()) {
        UI.startSpinner(`Pulling Character "${charName}"...`);
        // console.log(`Pulling Character "${charName}"...`);

        // 1. Fetch Character Data
        const rawCharData = await CharacterReader.getByName(charName);
        if (!rawCharData || !rawCharData.name) {
            throw new Error(`Character "${charName}" not found.`);
        }

        // Validate
        const charData = ValidationUtils.validate(CharacterSchema, rawCharData, `Remote Character ${charName}`);
        if (!charData) {
            throw new Error("Validation failed for remote character data.");
        }

        // 2. Prepare Directory
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        // 3. Extract and Write Files

        // 3.1 First Message
        if (charData.first_mes) {
            console.log(chalk.dim('   Extracting first_message.md...'));
            fs.writeFileSync(path.join(targetDir, 'first_message.md'), charData.first_mes, 'utf-8');
        }

        // 3.1.5 Alternate Greetings
        if (charData.alternate_greetings && Array.isArray(charData.alternate_greetings)) {
            charData.alternate_greetings.forEach((greeting: string, index: number) => {
                // index 0 -> first_message_01.md (Wait, first_mes is technically 01? Or is this 02?)
                // ST Logic: first_mes is main. alternates are added.
                // User said: "write 1234".
                // Let's use first_message_02.md, _03.md for alternates to keep main one clean.
                // Start index at 2?
                const fileNum = index + 2;
                const fileName = `first_message_${fileNum.toString().padStart(2, '0')}.md`;
                console.log(chalk.dim(`   Extracting ${fileName}...`));
                fs.writeFileSync(path.join(targetDir, fileName), greeting, 'utf-8');
            });
        }

        // 3.2 Description / Personality / Scenario
        if (charData.scenario) {
            console.log(chalk.dim('   Extracting scenario.md...'));
            fs.writeFileSync(path.join(targetDir, 'scenario.md'), charData.scenario, 'utf-8');
        }

        if (charData.description) {
            console.log(chalk.dim('   Extracting description.md...'));
            fs.writeFileSync(path.join(targetDir, 'description.md'), charData.description, 'utf-8');
        }

        // 3.3 Main Metadata (character.yaml)
        const metadata = { ...charData };
        delete metadata.first_mes;
        delete metadata.scenario;
        delete metadata.description;

        // console.log(chalk.dim('   Writing character.yaml...'));
        fs.writeFileSync(path.join(targetDir, 'character.yaml'), yaml.dump(metadata), 'utf-8');

        // 3.4 Character Card Image (PNG)
        if (charData.avatar && charData.avatar !== 'none') {
            try {
                // Ensure we have the full filename including extension
                const avatarName = charData.avatar.endsWith('.png') ? charData.avatar : `${charData.avatar}.png`;
                console.log(chalk.dim(`   Downloading character card image (${avatarName})...`));

                const imageBuffer = await CharacterReader.getAvatar(avatarName);
                if (imageBuffer && imageBuffer.byteLength > 0) {
                    // We save it as "card.png" to be the canonical image for this project
                    // This aligns with "One Folder = One Project" better than using the arbitrary ST filename
                    fs.writeFileSync(path.join(targetDir, 'card.png'), Buffer.from(imageBuffer));
                }
            } catch (e) {
                console.warn(chalk.yellow(`   ⚠️  Failed to download character image: ${(e as Error).message}`));
            }
        }

        // 4. Handle Linked Worldbooks
        // Check for character_book (embedded)
        if (charData.data && charData.data.character_book) {
            const worldBook = charData.data.character_book;
            if (worldBook && worldBook.entries) {
                console.log(chalk.cyan('   Found embedded Worldbook, extracting to linked_worldbooks/...'));
                const wbName = worldBook.name || `${charName}_Lore`;
                const wbDir = path.join(targetDir, 'linked_worldbooks', wbName);

                // Re-use common logic to save it as a proper Worldbook project structure
                await this.saveWorldBookLocal(worldBook, wbDir);
            }
        }

        UI.succeedSpinner(`Successfully pulled Character "${charName}"!`);
    }
}
