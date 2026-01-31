/**
 * Config Loader
 * Loads sillytavern.config.yaml or falls back to defaults.
 */

import chalk from 'chalk';
import dotenv from 'dotenv';
import yaml from 'js-yaml';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { CCSConfig } from '../types/index.ts';

// NOTE: We do NOT call dotenv.config() at top-level anymore.
// We lazily load it in ConfigLoader.load() to support finding it in parent dirs.

const CONFIG_FILENAME = 'sillytavern.config.yaml';
const DEFAULT_API_URL = 'http://127.0.0.1:8000';

export class ConfigLoader {
    private static instance: CCSConfig | null = null;
    private static configPath: string | null = null;
    private static envPath: string | null = null;

    /**
     * Helper to find a file by walking up directories.
     */
    private static findFileUp(filename: string, startDir: string = process.cwd()): string | null {
        let currentDir = startDir;
        const maxDepth = 10;
        let depth = 0;

        while (depth < maxDepth) {
            const filePath = path.join(currentDir, filename);
            if (fs.existsSync(filePath)) {
                return filePath;
            }

            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir) break;
            currentDir = parentDir;
            depth++;
        }
        return null;
    }

    /**
     * Finds the config file path.
     */
    static findConfigPath(startDir: string = process.cwd()): string | null {
        return this.findFileUp(CONFIG_FILENAME, startDir);
    }

    /**
     * Loads the configuration.
     */
    static getConfigPath(): string | null {
        return this.configPath;
    }

    /**
     * Loads the global configuration from ~/.ccs-cli/config.yaml
     */
    static loadGlobal(): Partial<CCSConfig> {
        try {
            const globalPath = path.join(os.homedir(), '.ccs-cli', 'config.yaml');
            if (fs.existsSync(globalPath)) {
                const content = fs.readFileSync(globalPath, 'utf8');
                return yaml.load(content) as Partial<CCSConfig>;
            }
        } catch (e) {
            // Ignore missing / invalid global config
        }
        return {};
    }

    /**
     * Loads the project configuration (sillytavern.config.yaml)
     */
    static loadProject(startDir: string = process.cwd()): Partial<CCSConfig> {
        const configPath = this.findConfigPath(startDir);
        this.configPath = configPath;
        if (configPath) {
            try {
                const content = fs.readFileSync(configPath, 'utf8');
                return yaml.load(content) as Partial<CCSConfig>;
            } catch (e) {
                console.warn(`[Config] Failed to parse ${CONFIG_FILENAME}`, e);
            }
        }
        return {};
    }

    /**
     * Loads the configuration.
     * Precedence: Env > Project > Global > Default
     */
    static load(): CCSConfig {
        if (this.instance) return this.instance;

        // 1. Load .env (find up)
        const envPath = this.findFileUp('.env');
        if (envPath) {
            this.envPath = envPath;
            console.error(chalk.dim(`[Config] Loading environment from: ${envPath}`));
            dotenv.config({ path: envPath });
        } else {
            console.error(chalk.yellow(`[Config] No .env file found in parent directories.`));
            dotenv.config();
        }

        // 2. Load Global
        const globalConfig = this.loadGlobal();

        // 3. Load Project
        const projectConfig = this.loadProject();

        // 4. Env Vars
        const envInsecure = process.env.ST_INSECURE_SSL?.trim().toLowerCase();
        const envConfig = {
            apiUrl: process.env.ST_API_URL,
            apiKey: process.env.ST_API_KEY,
            username: process.env.ST_USERNAME,
            password: process.env.ST_PASSWORD,
            insecure: (envInsecure === 'true' || envInsecure === '1') ? true : undefined,
        };

        // 5. Merge
        this.instance = {
            apiUrl: envConfig.apiUrl || projectConfig.apiUrl || globalConfig.apiUrl || DEFAULT_API_URL,
            apiKey: envConfig.apiKey || projectConfig.apiKey || globalConfig.apiKey,
            mode: projectConfig.mode || globalConfig.mode || 'worldbook',
            username: envConfig.username || projectConfig.username || globalConfig.username,
            password: envConfig.password || projectConfig.password || globalConfig.password,
            insecure: envConfig.insecure ?? projectConfig.insecure ?? globalConfig.insecure ?? false,
        };

        return this.instance;
    }
}
