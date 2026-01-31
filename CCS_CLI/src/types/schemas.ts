import { z } from 'zod';

// --- WorldBook Schemas ---

export const WorldInfoEntrySchema = z.object({
    uid: z.number().optional().default(0), // UID might be missing in older V1 arrays
    key: z.array(z.string()).default([]),
    keys: z.array(z.string()).optional(), // Legacy / API field (plural)
    keysecondary: z.array(z.string()).default([]),
    secondary_keys: z.array(z.string()).optional(), // Legacy / API field
    comment: z.string().optional(),
    content: z.string().default(''),
    constant: z.boolean().default(false),
    selective: z.boolean().default(true),
    selectiveLogic: z.number().int().default(0), // 0=AND, 1=OR, 2=NOT
    order: z.number().int().default(100),
    position: z.union([z.number().int(), z.string()]).default(0), // 0=before, 1=after (can be string)
    disable: z.boolean().default(false),
    excludeRecursion: z.boolean().default(true),
    preventRecursion: z.boolean().default(true),
    delayUntilRecursion: z.boolean().default(false),
    probability: z.number().min(0).max(100).default(100),
    useProbability: z.boolean().default(true),
    depth: z.number().int().default(4),
    group: z.string().default(''),
    groupOverride: z.boolean().default(false),
    groupWeight: z.number().default(100),
    scanDepth: z.number().nullable().default(null),
    caseSensitive: z.boolean().nullable().default(null),
    matchWholeWords: z.boolean().nullable().default(null),
    useGroupScoring: z.boolean().nullable().default(null),
    automationId: z.string().default(""),
    role: z.number().nullable().default(null),
    sticky: z.number().nullable().default(null),
    cooldown: z.number().nullable().default(null),
    delay: z.number().nullable().default(null),
});

export const WorldInfoSchema = z.object({
    entries: z.union([
        z.record(z.string(), WorldInfoEntrySchema),
        z.array(WorldInfoEntrySchema)
    ]),
    name: z.string().optional(),
});

// --- CCS v1.1 Index-Driven Schemas ---

// 1. Content File (entries/*.yaml) - Pure Content
export const ContentFileSchema = z.object({
    key: z.array(z.string()).default([]),
    keysecondary: z.array(z.string()).default([]),
    content: z.string().default(''),
});

// 2. Index Entry (index.yaml item) - Control Logic
export const IndexEntrySchema = z.object({
    id: z.string(), // Filename (without .yaml)
    comment: z.string().optional(), // Description for AI

    // Logic Props (Subset of WorldInfoEntry)
    enabled: z.boolean().optional(),
    constant: z.boolean().optional(),
    position: z.union([z.number(), z.string()]).optional(), // Allow string aliases like 'before_char'
    order: z.number().optional(),
    depth: z.number().optional(),
    probability: z.number().optional(),
    group: z.string().optional(),
    selective: z.boolean().optional(),
    role: z.number().nullable().optional(),

    // Advanced Logic
    sticky: z.number().nullable().optional(),
    cooldown: z.number().nullable().optional(),
    delay: z.number().nullable().optional(),
    excludeRecursion: z.boolean().optional(),
    preventRecursion: z.boolean().optional(),
    delayUntilRecursion: z.boolean().optional(),
    matchWholeWords: z.boolean().nullable().optional(),
    caseSensitive: z.boolean().nullable().optional(),
    useGroupScoring: z.boolean().nullable().optional(),
    automationId: z.string().optional(),
    scanDepth: z.number().nullable().optional(),
    groupOverride: z.boolean().optional(),
});

// 3. Index File (index.yaml)
export const IndexFileSchema = z.object({
    book_name: z.string().optional(),
    global_settings: z.object({
        recursive: z.boolean().optional(),
    }).optional(),
    entries: z.array(IndexEntrySchema),
});


// --- Character Schemas ---

export const CharacterSchema = z.object({
    name: z.string().min(1, "Character name is required"),
    description: z.string().optional(),
    personality: z.string().optional(),
    scenario: z.string().optional(),
    first_mes: z.string().optional(),
    mes_example: z.string().optional(),
    avatar: z.string().optional(),

    // V2 spec fields
    creator_notes: z.string().optional(),
    system_prompt: z.string().optional(),
    post_history_instructions: z.string().optional(),
    alternate_greetings: z.array(z.string()).default([]),

    // V2 Data structure
    data: z.object({
        character_book: WorldInfoSchema.optional(),
    }).optional(),

    // Extensions
    tags: z.array(z.string()).default([]),
    creator: z.string().optional(),
    character_version: z.string().optional(),
});

export type WorldInfoEntry = z.infer<typeof WorldInfoEntrySchema>;
export type WorldInfo = z.infer<typeof WorldInfoSchema>;
export type Character = z.infer<typeof CharacterSchema>;

export type ContentFile = z.infer<typeof ContentFileSchema>;
export type IndexEntry = z.infer<typeof IndexEntrySchema>;
export type IndexFile = z.infer<typeof IndexFileSchema>;
