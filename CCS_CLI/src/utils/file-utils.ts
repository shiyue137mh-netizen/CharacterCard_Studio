import fs from 'node:fs';
import path from 'node:path';

export class FileUtils {
    /**
     * Recursively find an entry file (yaml/yml) in a directory.
     * @param baseEntriesDir The root directory to search (e.g. project/entries)
     * @param entryId The ID of the entry to find (without extension)
     * @returns Absolute path to the file if found, null otherwise.
     */
    static findEntryFile(baseEntriesDir: string, entryId: string): string | null {
        if (!fs.existsSync(baseEntriesDir)) return null;

        // 1. Try direct match (Fast path)
        const directYaml = path.join(baseEntriesDir, `${entryId}.yaml`);
        if (fs.existsSync(directYaml)) return directYaml;

        const directYml = path.join(baseEntriesDir, `${entryId}.yml`);
        if (fs.existsSync(directYml)) return directYml;

        // 2. Recursive Search
        const search = (dir: string): string | null => {
            const files = fs.readdirSync(dir, { withFileTypes: true });
            const normalizedIdNFC = entryId.normalize('NFC');
            const normalizedIdNFD = entryId.normalize('NFD');

            for (const file of files) {
                if (file.isDirectory()) {
                    const found = search(path.join(dir, file.name));
                    if (found) return found;
                } else if (file.isFile()) {
                    const baseName = path.parse(file.name).name;
                    const normalizedBaseNFC = baseName.normalize('NFC');
                    const normalizedBaseNFD = baseName.normalize('NFD');

                    if (normalizedBaseNFC === normalizedIdNFC || normalizedBaseNFD === normalizedIdNFD) {
                        if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) {
                            return path.join(dir, file.name);
                        }
                    }
                }
            }
            return null;
        };

        return search(baseEntriesDir);
    }
}
