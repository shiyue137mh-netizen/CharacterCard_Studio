/**
 * CCS Project Types
 */

export interface CCSConfig {
    /**
     * SillyTavern API Base URL
     * Default: http://127.0.0.1:8000
     */
    apiUrl: string;

    /**
     * SillyTavern API Key (optional)
     */
    apiKey?: string;

    /**
     * Project Mode
     * - worldbook: Dedicated Worldbook Project
     * - character: Character Monorepo
     */
    mode?: 'worldbook' | 'character';

    /**
     * SillyTavern Username (Basic Auth)
     */
    username?: string;

    /**
     * SillyTavern Password (Basic Auth)
     */
    password?: string;

    /**
     * Disable SSL Verification (INSECURE)
     * Use only for localhost with self-signed certs.
     */
    insecure?: boolean;
}

export interface ProjectStructure {
    root: string;
    hasConfig: boolean;
    configPath?: string;
    entriesDir: string;
    indexFile: string;
}

// Re-export zod types as SSOT
export type { ContentFile, IndexEntry, IndexFile, WorldInfo, WorldInfoEntry } from './schemas';

export interface SimplifiedEntry {
    name: string;
    key: string[];
    keysecondary?: string[];
    content: string;
    enabled: boolean;
    constant?: boolean;
    position?: string;
    depth?: number;
    order?: number;
    probability?: number;
    group?: string;
}
