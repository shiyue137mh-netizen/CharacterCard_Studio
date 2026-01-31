/**
 * Sync Service
 * Handles data synchronization between Local FS and SillyTavern API.
 */

import chalk from 'chalk';
import yaml from 'js-yaml';
import fs from 'node:fs';
import path from 'node:path';
import { TavernAPI } from '../api/tavern-api';
import type { ContentFile, WorldInfo, WorldInfoEntry } from '../types/index';
import { CharacterSchema, WorldInfoEntrySchema, WorldInfoSchema } from '../types/schemas';
import { UI } from '../ui/progress';
import { FileUtils } from '../utils/file-utils';
import { YamlParser } from '../utils/parser';
import { ValidationUtils } from '../utils/validator';

export class SyncService {

    /**
     * Helper to find entry file recursively in entries/ directory
     */
    private static findEntryFile(baseEntriesDir: string, entryId: string): string | null {
        if (!fs.existsSync(baseEntriesDir)) return null;

        // 1. Try direct match (Fast path)
        const directYaml = path.join(baseEntriesDir, `${entryId}.yaml`);
        if (fs.existsSync(directYaml)) return directYaml;

        const directYml = path.join(baseEntriesDir, `${entryId}.yml`);
        if (fs.existsSync(directYml)) return directYml;

        // 2. Recursive Search
        const search = (dir: string): string | null => {
            const files = fs.readdirSync(dir, { withFileTypes: true });

            for (const file of files) {
                if (file.isDirectory()) {
                    const found = search(path.join(dir, file.name));
                    if (found) return found;
                } else if (file.isFile()) {
                    if (file.name === `${entryId}.yaml` || file.name === `${entryId}.yml`) {
                        return path.join(dir, file.name);
                    }
                }
            }
            return null;
        };

        return search(baseEntriesDir);
    }

    /**
     * Load a local Worldbook structure into a WorldInfo object
     */
    public static loadWorldBookFromLocal(wbPath: string): WorldInfo {
        const indexPath = path.join(wbPath, 'index.yaml');
        if (!fs.existsSync(indexPath)) {
            return { entries: {} };
        }

        const indexContent = fs.readFileSync(indexPath, 'utf-8');
        const index = YamlParser.parseIndex(indexContent);
        const worldInfo: WorldInfo = { entries: {} };
        const entriesDir = path.join(wbPath, 'entries');

        if (index.entries && Array.isArray(index.entries)) {
            for (let i = 0; i < index.entries.length; i++) {
                const indexEntry = index.entries[i];
                if (!indexEntry.id) {
                    // Skip entries without ID (malformed)
                    continue;
                }

                // Find content file recursively
                const entryPath = FileUtils.findEntryFile(entriesDir, indexEntry.id);

                let contentData: ContentFile = { key: [], keysecondary: [], content: "" };

                if (entryPath) {
                    try {
                        const yamlContent = fs.readFileSync(entryPath, 'utf-8');
                        contentData = YamlParser.parseContent(yamlContent);
                    } catch (e) {
                        console.warn(chalk.yellow(`Warning: Failed to parse content file for ${indexEntry.id}`));
                        continue; // Skip broken content
                    }
                } else {
                    // If file is missing, we treat this as "Intentional Deletion" by the user
                    // We skip it so the remote update (which overwrites) will remove it
                    console.log(chalk.red(`   🗑️  Entry file missing for "${indexEntry.id}", will be removed from remote.`));
                    continue;
                }

                const id = i; // Use index as ID for order stability in ST

                const fullEntry: WorldInfoEntry = {
                    uid: id,

                    // Content
                    key: contentData.key,
                    keysecondary: contentData.keysecondary || [],
                    content: contentData.content,

                    // Metadata / Logic
                    comment: indexEntry.comment || indexEntry.id,
                    disable: indexEntry.enabled === false,
                    constant: indexEntry.constant || false,
                    selective: indexEntry.selective !== false,
                    order: indexEntry.order ?? 100,
                    position: typeof indexEntry.position === 'number' ? indexEntry.position : 0, // Resolve string alias later if needed
                    depth: indexEntry.depth ?? 4,
                    probability: indexEntry.probability ?? 100,
                    group: indexEntry.group || '',
                    role: indexEntry.role || null,

                    // Defaults for others
                    selectiveLogic: 0,
                    excludeRecursion: indexEntry.excludeRecursion || false,
                    preventRecursion: indexEntry.preventRecursion || false,
                    delayUntilRecursion: indexEntry.delayUntilRecursion || false,
                    useProbability: true,
                    scanDepth: null,
                    caseSensitive: indexEntry.caseSensitive || null,
                    matchWholeWords: indexEntry.matchWholeWords || null,
                    useGroupScoring: indexEntry.useGroupScoring || null,
                    automationId: indexEntry.automationId || "",
                    sticky: indexEntry.sticky || null,
                    cooldown: indexEntry.cooldown || null,
                    delay: indexEntry.delay || null,
                    groupOverride: false,
                    groupWeight: 100,
                };

                const validated = ValidationUtils.validate(WorldInfoEntrySchema, fullEntry, `Entry ${indexEntry.id}`) as WorldInfoEntry | null;
                if (validated) {
                    // We know local loading builds a Record
                    (worldInfo.entries as Record<string, WorldInfoEntry>)[String(id)] = validated;
                }
            }
        }
        return worldInfo;
    }

    /**
     * Push local Character to SillyTavern
     */
    static async pushCharacter(charName: string, projectPath: string) {
        UI.startSpinner(`Pushing Character "${charName}"...`);

        // 1. Resolve Target Filename via API
        const remoteChar = await import('../api/api-wrappers').then(m => m.CharacterReader.getByName(charName));

        // If not found, we can't edit.
        if (!remoteChar) {
            throw new Error(`Character "${charName}" not found on server. Cannot update.`);
        }
        const avatarUrl = remoteChar.avatar;

        // 2. Read Local Metadata
        const charYamlPath = path.join(projectPath, 'character.yaml');
        if (!fs.existsSync(charYamlPath)) {
            throw new Error("Missing character.yaml");
        }
        const metadata = yaml.load(fs.readFileSync(charYamlPath, 'utf-8')) as any;

        // 3. Read Markdown Content
        if (fs.existsSync(path.join(projectPath, 'first_message.md'))) {
            metadata.first_mes = fs.readFileSync(path.join(projectPath, 'first_message.md'), 'utf-8');
        }

        // 3.1 Read Alternate Greetings
        // Look for first_message_*.md (e.g. first_message_02.md)
        const projectFiles = fs.readdirSync(projectPath);
        const altGreetingFiles = projectFiles
            .filter(f => f.startsWith('first_message_') && f.endsWith('.md') && f !== 'first_message.md')
            .sort(); // Natural sort should work for _02, _03

        if (altGreetingFiles.length > 0) {
            const alternate_greetings: string[] = [];
            for (const file of altGreetingFiles) {
                const content = fs.readFileSync(path.join(projectPath, file), 'utf-8');
                alternate_greetings.push(content);
            }
            metadata.alternate_greetings = alternate_greetings;
            console.log(chalk.dim(`   Loaded ${alternate_greetings.length} alternate greetings.`));
        }
        if (fs.existsSync(path.join(projectPath, 'description.md'))) {
            metadata.description = fs.readFileSync(path.join(projectPath, 'description.md'), 'utf-8');
        }
        if (fs.existsSync(path.join(projectPath, 'scenario.md'))) {
            metadata.scenario = fs.readFileSync(path.join(projectPath, 'scenario.md'), 'utf-8');
        }

        // 4. Handle Embedded Worldbooks
        const linkedWbDir = path.join(projectPath, 'linked_worldbooks');
        if (fs.existsSync(linkedWbDir)) {
            const books = fs.readdirSync(linkedWbDir);
            if (books.length > 0) {
                const wbName = books[0];
                const wbPath = path.join(linkedWbDir, wbName);
                const wbData = this.loadWorldBookFromLocal(wbPath);

                // Assign to V2 structure
                if (!metadata.data) metadata.data = {};
                metadata.data.character_book = {
                    name: wbName,
                    entries: wbData.entries
                };
                UI.startSpinner(`Embedding Worldbook "${wbName}" into character card...`);
            }
        }

        // Validate Character Metadata
        const validatedChar = ValidationUtils.validate(CharacterSchema, metadata, `Character ${charName}`);
        if (!validatedChar) {
            throw new Error(`Invalid Character data for "${charName}". Check the logs above.`);
        }

        // 5. Send Update
        await TavernAPI.fetch('/api/characters/edit', {
            method: 'POST',
            body: JSON.stringify({
                avatar_url: avatarUrl,
                ch_name: metadata.name,
                // Pass full object to allow extensions/wb update
                json_data: JSON.stringify(metadata)
            })
        });

        UI.succeedSpinner(`Successfully pushed Character "${charName}"!`);
    }

    /**
     * Push local Worldbook to SillyTavern
     */
    static async pushWorldBook(projectPath: string, projectDirName: string) {
        const indexPath = path.join(projectPath, 'index.yaml');
        if (!fs.existsSync(indexPath)) throw new Error("Missing index.yaml");

        // Use shared loader
        const wbData = this.loadWorldBookFromLocal(projectPath);

        // Validate
        const validatedWb = ValidationUtils.validate(WorldInfoSchema, wbData, `WorldBook ${projectDirName}`);
        if (!validatedWb) {
            throw new Error(`Invalid WorldBook data for "${projectDirName}". Check logs above.`);
        }

        // Push
        UI.startSpinner(`Pushing WorldBook "${projectDirName}"...`);
        await TavernAPI.fetch('/api/worldinfo/edit', {
            method: 'POST',
            body: JSON.stringify({
                name: projectDirName,
                data: wbData
            })
        });
        UI.succeedSpinner(`Successfully pushed to SillyTavern!`);
    }

    /**
     * Main Push Entry Point
     */
    static async push(projectPath: string = process.cwd()) {
        const projectDirName = path.basename(projectPath);

        // Auto-detect type
        if (fs.existsSync(path.join(projectPath, 'character.yaml'))) {
            await this.pushCharacter(projectDirName, projectPath);
        } else if (fs.existsSync(path.join(projectPath, 'index.yaml'))) {
            await this.pushWorldBook(projectPath, projectDirName);
        } else {
            throw new Error(`Unknown project type in ${projectPath} (No character.yaml or index.yaml)`);
        }
    }
}
