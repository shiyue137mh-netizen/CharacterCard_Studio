/**
 * YAML Parser
 * Handles conversion between WorldBook Entries and simplified YAML.
 */

import YAML from "yaml";
import type { ContentFile, IndexFile, SimplifiedEntry, WorldInfoEntry } from "../types/index";

const POSITION_NAMES: Record<number, string> = {
    0: "before_character_definition",
    1: "after_character_definition",
    2: "before_example_messages",
    3: "after_example_messages",
    4: "before_author_note",
    5: "after_author_note",
    6: "at_depth",
};

const POSITION_VALUES: Record<string, number> = Object.fromEntries(
    Object.entries(POSITION_NAMES).map(([k, v]) => [v, Number(k)])
);

export class YamlParser {
    /**
     * Convert WorldInfoEntry to Simplified YAML string
     */
    static entryToYaml(entry: WorldInfoEntry): string {
        // 1. Basic Metadata
        const simplified: any = {
            name: entry.comment || "(No Name)",
            key: entry.key || [],
            enabled: !entry.disable,
        };

        // 2. Configuration Fields (only if non-default)
        if (entry.keysecondary && entry.keysecondary.length > 0) {
            simplified.keysecondary = entry.keysecondary;
        }
        if (entry.constant) simplified.constant = true;
        if (entry.position !== 0) {
            simplified.position = POSITION_NAMES[entry.position] || String(entry.position);
        }
        if (entry.depth !== 4) simplified.depth = entry.depth;
        if (entry.order !== 100) simplified.order = entry.order;
        if (entry.probability !== 100) simplified.probability = entry.probability;
        if (entry.group) simplified.group = entry.group;

        // 3. Content (Last for readability)
        simplified.content = entry.content || "";

        return YAML.stringify(simplified, {
            lineWidth: 0,
            defaultStringType: "PLAIN", // Avoid excessive quoting
            defaultKeyType: "PLAIN",
        });
    }

    /**
     * Parse YAML string back to partial WorldInfoEntry
     */
    static yamlToEntry(yamlContent: string): Partial<WorldInfoEntry> {
        const parsed = YAML.parse(yamlContent) as SimplifiedEntry;

        const entry: Partial<WorldInfoEntry> = {
            comment: parsed.name,
            key: parsed.key || [],
            content: parsed.content || "",
            disable: parsed.enabled === false,
        };

        if (parsed.keysecondary) entry.keysecondary = parsed.keysecondary;
        if (parsed.constant !== undefined) entry.constant = parsed.constant;

        if (parsed.position !== undefined) {
            entry.position = typeof parsed.position === "string"
                ? POSITION_VALUES[parsed.position] ?? 0
                : parsed.position as unknown as number;
        }

        if (parsed.depth !== undefined) entry.depth = parsed.depth;
        if (parsed.order !== undefined) entry.order = parsed.order;
        if (parsed.probability !== undefined) entry.probability = parsed.probability;
        if (parsed.group !== undefined) entry.group = parsed.group;

        return entry;
    }


    // --- v1.1 Index-Driven Parser ---

    static parseIndex(yamlContent: string): IndexFile {
        const parsed = YAML.parse(yamlContent);
        return {
            book_name: parsed.book_name,
            global_settings: parsed.global_settings,
            entries: Array.isArray(parsed.entries) ? parsed.entries : [],
        };
    }

    static stringifyIndex(index: IndexFile): string {
        // Use default stringify
        const yamlStr = YAML.stringify(index, { defaultKeyType: "PLAIN", defaultStringType: "PLAIN" });

        // Post-processing: Add extra newline before each "- " list item to space out entries
        return yamlStr.replace(/(\n\s*)- /g, '\n$1- ');
    }

    static parseContent(yamlContent: string): ContentFile {
        const parsed = YAML.parse(yamlContent);
        return {
            key: parsed.key || [],
            keysecondary: parsed.keysecondary || [],
            content: parsed.content || "",
        };
    }

    static stringifyContent(content: ContentFile): string {
        // Only include key/secondary if they exist
        const output: any = {};
        // User Request: key is always present, even if empty
        output.key = content.key || [];

        // User Request: No secondary keys
        // if (content.keysecondary?.length) output.keysecondary = content.keysecondary;

        output.content = content.content || "";

        return YAML.stringify(output, {
            lineWidth: 0,
            defaultStringType: "PLAIN",
            defaultKeyType: "PLAIN"
        });
    }
}
