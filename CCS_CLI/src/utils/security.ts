import path from 'path';

/**
 * Security Utility Module
 * Wraps critical operations to prevent common vulnerabilities (Path Traversal, Data Leakage).
 */

/**
 * Safely resolves a file path within a specific base directory.
 * Prevents Path Traversal attacks (e.g. "../../../etc/passwd").
 *
 * @param basePath The allowed root directory (e.g., project root or specific resource folder).
 * @param userInput The user-provided filename or relative path.
 * @returns The resolved safe absolute path.
 * @throws Error if the resolved path is outside the basePath or contains illegal characters.
 */
export function resolveSafePath(basePath: string, userInput: string): string {
    // 1. Basic Input Sanity Check
    if (!userInput || typeof userInput !== 'string') {
        throw new Error('Invalid path input: Input must be a non-empty string.');
    }

    // 2. Prevent Null Byte Injection
    if (userInput.indexOf('\0') !== -1) {
        throw new Error('Invalid path input: Null byte detected.');
    }

    // 3. Resolve Absolute Path
    const safeBase = path.resolve(basePath);
    const resolvedPath = path.resolve(safeBase, userInput);

    // 4. Path Containment Check
    // We append path.sep to ensure we don't match partial folder names (e.g. /var/www vs /var/www-secret)
    // explicitly allow exact match (root) or subdirectory
    if (resolvedPath !== safeBase && !resolvedPath.startsWith(safeBase + path.sep)) {
        throw new Error(`Access denied: Path traversal detected. "${userInput}" attempts to access outside of "${basePath}"`);
    }

    return resolvedPath;
}

/**
 * Sanitizes Character Data for MCP / LLM consumption.
 * Removes sensitive paths, system metadata, and private notes.
 *
 * @param char The raw character object from SillyTavern.
 * @returns A cleaner, safer subset of character data.
 */
export function sanitizeCharacterData(char: any): any {
    if (!char) return null;

    return {
        // Core Identity
        name: char.name,
        description: char.description,
        personality: char.personality,

        // Scenario & Context
        scenario: char.scenario,
        first_mes: char.first_mes,
        mes_example: char.mes_example,

        // Metadata
        tags: char.tags,
        creator: char.creator,
        character_version: char.character_version,

        // EXCLUDED:
        // - avatar: Full local system path
        // - chat: Path to chat logs
        // - extensions: Internal extension settings
        // - create_date/edit_date: Low value noise
    };
}
