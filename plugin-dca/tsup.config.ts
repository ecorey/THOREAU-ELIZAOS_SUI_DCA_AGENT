import { defineConfig } from "tsup";
export default defineConfig({
    entry: ["src/index.ts"],
    outDir: "dist",
    sourcemap: true,
    clean: true,
    format: ["esm", "cjs"],
    external: [
        "dotenv",
        "fs",
        "path",
        "@reflink/reflink",
        "@node-llama-cpp",
        "https",
        "http",
        "agentkeepalive",
        "safe-buffer",
        "base-x",
        "bs58",
        "borsh",
        "@solana/buffer-layout",
        "stream",
        "buffer",
        "querystring",
        "amqplib",
        "@elizaos/core",
        "@firefly-exchange/library-sui",
        "node-fetch"  
    ],
    dts: true,
    esbuildOptions(options) {
        options.banner = {
            js: `import { createRequire } from 'module';const require = createRequire(import.meta.url);`,
        };
        // Add for better ESM compatibility
        options.platform = 'node';
        options.target = 'node16';
    }
});