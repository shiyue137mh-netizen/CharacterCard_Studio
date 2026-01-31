import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/mcp/server.ts'], // Main CLI + separate MCP entry if needed
    format: ['esm'],
    target: 'node18',
    clean: true,
    dts: true, // Generate declaration files
    sourcemap: true,
    splitting: false, // For CLI usually false, but can be true
    outDir: 'dist',
    banner: {
        js: '#!/usr/bin/env node', // Add shebang to output
    },
    // tsup automatically excludes node_modules dependenceis (unlike webpack/rollup default)
});
