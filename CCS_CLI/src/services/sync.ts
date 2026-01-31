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
                    continue;
                }

                const entryPath = FileUtils.findEntryFile(entriesDir, indexEntry.id);
                let contentData: ContentFile = { key: [], keysecondary: [], content: "" };

                if (entryPath) {
                    try {
                        const yamlContent = fs.readFileSync(entryPath, 'utf-8');
                        contentData = YamlParser.parseContent(yamlContent);
                    } catch (e) {
                        console.warn(chalk.yellow(`Warning: Failed to parse content file for ${indexEntry.id}`));
                        continue;
                    }
                } else {
                    console.log(chalk.red(`   🗑️  Entry file missing for "${indexEntry.id}", will be removed from remote.`));
                    continue;
                }

                const id = i;
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
                    position: typeof indexEntry.position === 'number' ? indexEntry.position : 0,
                    depth: indexEntry.depth ?? 4,
                    probability: indexEntry.probability ?? 100,
                    group: indexEntry.group || '',
                    role: indexEntry.role || 0,

                    // Original ST fields
                    selectiveLogic: 0,
                    excludeRecursion: indexEntry.excludeRecursion || false,
                    preventRecursion: indexEntry.preventRecursion || false,
                    delayUntilRecursion: !!indexEntry.delayUntilRecursion,
                    useProbability: true,
                    scanDepth: indexEntry.scanDepth ?? null,
                    caseSensitive: indexEntry.caseSensitive ?? null,
                    matchWholeWords: indexEntry.matchWholeWords ?? null,
                    useGroupScoring: indexEntry.useGroupScoring ?? false,
                    automationId: indexEntry.automationId || "",
                    sticky: indexEntry.sticky ?? null,
                    cooldown: indexEntry.cooldown ?? null,
                    delay: indexEntry.delay ?? null,
                    groupOverride: indexEntry.groupOverride || false,
                    groupWeight: indexEntry.groupWeight ?? 100,
                };

                const validated = ValidationUtils.validate(WorldInfoEntrySchema, fullEntry, `Entry ${indexEntry.id}`) as WorldInfoEntry | null;
                if (validated) {
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

        const remoteChar = await import('../api/api-wrappers').then(m => m.CharacterReader.getByName(charName));
        if (!remoteChar) {
            throw new Error(`Character "${charName}" not found on server. Cannot update.`);
        }
        const avatarUrl = remoteChar.avatar;
        // Capture preservation fields
        const chat = remoteChar.chat;
        const create_date = remoteChar.create_date;

        const charYamlPath = path.join(projectPath, 'character.yaml');
        if (!fs.existsSync(charYamlPath)) {
            throw new Error("Missing character.yaml");
        }
        const metadata = yaml.load(fs.readFileSync(charYamlPath, 'utf-8')) as any;

        if (fs.existsSync(path.join(projectPath, 'first_message.md'))) {
            metadata.first_mes = fs.readFileSync(path.join(projectPath, 'first_message.md'), 'utf-8');
        }

        const projectFiles = fs.readdirSync(projectPath);
        const altGreetingFiles = projectFiles
            .filter(f => f.startsWith('first_message_') && f.endsWith('.md') && f !== 'first_message.md')
            .sort();

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

        let worldName = '';
        const linkedWbDir = path.join(projectPath, 'linked_worldbooks');
        if (fs.existsSync(linkedWbDir)) {
            const books = fs.readdirSync(linkedWbDir).filter(f => !f.startsWith('.'));
            if (books.length > 0) {
                const primaryWbName = books[0];
                worldName = primaryWbName;
                if (!metadata.data) metadata.data = {};
                if (!metadata.data.extensions) (metadata.data as any).extensions = {};
                (metadata.data.extensions as any).world = primaryWbName;
                metadata.data.character_book = undefined;

                for (const wbName of books) {
                    const wbPath = path.join(linkedWbDir, wbName);
                    UI.startSpinner(`Syncing global worldbook "${wbName}"...`);
                    await this.pushWorldBook(wbPath, wbName);
                }
            }
        }

        const validatedChar = ValidationUtils.validate(CharacterSchema, metadata, `Character ${charName}`);
        if (!validatedChar) {
            throw new Error(`Invalid Character data for "${charName}". Check the logs above.`);
        }

        // Construct extensions object for the API (bypassing world embedding logic)
        const extensionsPayload = worldName ? JSON.stringify({ world: worldName }) : undefined;

        await TavernAPI.fetch('/api/characters/edit', {
            method: 'POST',
            body: JSON.stringify({
                avatar_url: avatarUrl,
                ch_name: metadata.name,
                description: metadata.description || '',
                personality: metadata.personality || '',
                scenario: metadata.scenario || '',
                first_mes: metadata.first_mes || '',
                mes_example: metadata.mes_example || '',
                // Preservation fields
                chat: chat,
                create_date: create_date,
                // Pass extensions explicitly to trigger deepMerge and restore the link
                extensions: extensionsPayload,
                json_data: JSON.stringify(metadata)
            })
        });
        UI.succeedSpinner(`Successfully pushed Character "${charName}"!`);
    }

    /**
     * Push local Worldbook to SillyTavern
     */
    static async pushWorldBook(projectPath: string, bookName?: string) {
        const finalName = bookName || path.basename(projectPath);
        const indexPath = path.join(projectPath, 'index.yaml');
        if (!fs.existsSync(indexPath)) throw new Error("Missing index.yaml");

        const wbData = this.loadWorldBookFromLocal(projectPath);

        const validatedWb = ValidationUtils.validate(WorldInfoSchema, wbData, `WorldBook ${finalName}`);
        if (!validatedWb) {
            throw new Error(`Invalid WorldBook data for "${finalName}". Check logs above.`);
        }

        UI.startSpinner(`Pushing WorldBook "${finalName}"...`);
        await TavernAPI.fetch('/api/worldinfo/edit', {
            method: 'POST',
            body: JSON.stringify({
                name: finalName,
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

        if (fs.existsSync(path.join(projectPath, 'character.yaml'))) {
            await this.pushCharacter(projectDirName, projectPath);
        } else if (fs.existsSync(path.join(projectPath, 'index.yaml'))) {
            await this.pushWorldBook(projectPath, projectDirName);
        } else {
            throw new Error(`Unknown project type in ${projectPath} (No character.yaml or index.yaml)`);
        }
    }
}
