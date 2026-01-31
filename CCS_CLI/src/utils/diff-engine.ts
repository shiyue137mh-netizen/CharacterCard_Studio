import { Change, diffLines } from 'diff';
import { WorldBookReader } from '../api/api-wrappers';
import { SyncService } from '../services/sync';
import { WorldInfo, WorldInfoEntry } from '../types';

export interface DiffResult {
    localOnly: string[];
    remoteOnly: string[];
    modified: {
        id: string;
        diffs: Change[];
    }[];
}

export class DiffEngine {

    /**
     * Compare a local Worldbook directory with a remote Worldbook on SillyTavern.
     */
    static async compareWorldBook(localPath: string, remoteName: string): Promise<DiffResult> {
        // 1. Load Local
        const localWorldInfo = SyncService.loadWorldBookFromLocal(localPath);

        // 2. Load Remote
        let remoteWorldInfo: WorldInfo;
        try {
            const remoteData = await WorldBookReader.getByName(remoteName);
            remoteWorldInfo = remoteData as unknown as WorldInfo;
        } catch (e) {
            throw new Error(`Failed to fetch remote worldbook '${remoteName}': ${e}`);
        }

        const localEntries = localWorldInfo.entries as Record<string, WorldInfoEntry>; // Local is Record

        // Normalize Remote to Record<string, Entry>
        let remoteEntriesRecord: Record<string, WorldInfoEntry> = {};
        if (Array.isArray(remoteWorldInfo.entries)) {
            remoteWorldInfo.entries.forEach((e: any) => {
                remoteEntriesRecord[String(e.uid)] = e;
            });
        } else {
            remoteEntriesRecord = remoteWorldInfo.entries || {};
        }

        // 3. Smart Align: Map entries by "Identity" (Comment/Name)
        // If comments are missing or duplicates exist, this might be tricky,
        // but for a "Diff", name-based is usually what users want.

        const getEntryIdentity = (entry: WorldInfoEntry, fallbackId: string) => {
            // Use comment as primary identity, fallback to original ID logic if empty
            if (entry.comment && entry.comment.trim().length > 0) {
                return entry.comment.trim();
            }
            return `__index_${fallbackId}`; // Fallback for unnamed entries
        };

        const localMap = new Map<string, WorldInfoEntry>();
        Object.keys(localEntries).forEach(k => {
            const entry = localEntries[k];
            const id = getEntryIdentity(entry, k);
            // If duplicate, last one wins? Or warn?
            // In ST, duplicate names are allowed. But for CCS we want to map them.
            // If we have duplicates, we can append index to subsequent ones?
            if (localMap.has(id)) {
                // Heuristic: Append _dup?
                // For now, let's just overwrite or ignore.
                // A better approach might be: Map<Name, Entry[]>
                // But let's assume unique names for best effort diff.
            }
            localMap.set(id, entry);
        });

        const remoteMap = new Map<string, WorldInfoEntry>();
        Object.keys(remoteEntriesRecord).forEach(k => {
            const entry = remoteEntriesRecord[k];
            const id = getEntryIdentity(entry, k);
            remoteMap.set(id, entry);
        });

        // 4. Compare based on Identity Map
        const localKeys = Array.from(localMap.keys());
        const remoteKeys = Array.from(remoteMap.keys());

        const localSet = new Set(localKeys);
        const remoteSet = new Set(remoteKeys);

        const localOnly = localKeys.filter(k => !remoteSet.has(k));
        const remoteOnly = remoteKeys.filter(k => !localSet.has(k));
        const commonKeys = localKeys.filter(k => remoteSet.has(k));

        const modified: { id: string; diffs: Change[] }[] = [];

        for (const key of commonKeys) {
            const localEntry = localMap.get(key)!;
            const remoteEntry = remoteMap.get(key)!;

            const localYaml = this.normalizeEntry(localEntry as WorldInfoEntry);
            const remoteYaml = this.normalizeEntry(remoteEntry as WorldInfoEntry);

            if (localYaml !== remoteYaml) {
                const diffs = diffLines(remoteYaml, localYaml);
                modified.push({ id: key, diffs });
            }
        }

        return { localOnly, remoteOnly, modified };
    }

    private static normalizeEntry(entry: WorldInfoEntry): string {
        // Fields to explicitly ignore in Diff (Noisy ST metadata)
        const IGNORED_FIELDS = new Set([
            'uid',
            'displayIndex',
            'extensions',
            'addMemo',
            'characterFilter',
            'triggers',     // Often empty arrays
            'rescan',       // ST internal
            'ignoreBudget',
            'matchCharacterDepthPrompt',
            'matchCharacterDescription',
            'matchCharacterPersonality',
            'matchCreatorNotes',
            'matchPersonaDescription',
            'matchScenario',
            'useGroupScoring',
            'vectorized'
        ]);

        // We also want to ignore default values to reduce noise?
        // For now, explicit ignores are safer.

        const clean: any = {};
        const keys = Object.keys(entry).sort();

        for (const k of keys) {
            // content is valid even if empty string, so check strictly for undefined/null
            const val = (entry as any)[k];

            if (val === undefined || val === null) continue;
            if (IGNORED_FIELDS.has(k)) continue;

            // Optional: Filter common defaults if they are 0/false/empty?
            // E.g. sticky: 0, cooldown: 0, delay: 0, role: 0
            if ((k === 'sticky' || k === 'cooldown' || k === 'delay' || k === 'role') && val === 0) continue;

            clean[k] = val;
        }

        // To generic string
        return JSON.stringify(clean, null, 2);
    }
}
