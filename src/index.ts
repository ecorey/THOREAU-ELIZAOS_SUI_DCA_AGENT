import { DirectClient } from "@elizaos/client-direct";
import {
  AgentRuntime,
  elizaLogger,
  settings,
  stringToUuid,
  type Character,
  CacheManager,
  DbCacheAdapter,
  type IDatabaseCacheAdapter,
} from "@elizaos/core";
import { createNodePlugin } from "@elizaos/plugin-node";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeClients } from "./clients/index.js";
import { initializeDatabase } from "./database/index.js";
import { getTokenForProvider } from "./config/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadCharacter(characterPath: string): Promise<Character> {
  try {
    const fullPath = path.resolve(__dirname, '..', characterPath);
    elizaLogger.info('Loading character from:', fullPath);
    const fileContent = fs.readFileSync(fullPath, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    elizaLogger.error(`Error loading character from ${characterPath}:`, error);
    throw error;
  }
}

function createAgent(character: Character, db: any, cache: any, token: string) {
  elizaLogger.success("Creating runtime for character", character.name);
  const nodePlugin = createNodePlugin();

  return new AgentRuntime({
    databaseAdapter: db,
    token,
    modelProvider: character.modelProvider,
    evaluators: [],
    character,
    plugins: [nodePlugin].filter(Boolean),
    providers: [],
    actions: [],
    services: [],
    managers: [],
    cacheManager: cache,
  });
}

function initializeDbCache(character: Character, db: IDatabaseCacheAdapter) {
  if (!character?.id) {
    throw new Error("initializeFsCache requires id to be set in character definition");
  }
  return new CacheManager(new DbCacheAdapter(db, character.id));
}

async function startAgent() {
  try {
    const characterPath = process.argv.find(arg => arg.includes('--character='))?.split('=')[1] 
      || 'characters/thoreau.character.json';
    elizaLogger.info('Loading character from:', characterPath);
    
    let character;
    try {
      character = await loadCharacter(characterPath);
      
      if (!character.name || !character.modelProvider) {
        throw new Error('Character must have name and modelProvider defined');
      }
      
      elizaLogger.info('Character loaded:', {
        name: character.name,
        modelProvider: character.modelProvider,
        clients: character.clients
      });
    } catch (error) {
      elizaLogger.error('Failed to load or validate character:', error);
      throw error;
    }

    let db;
    try {
      const dataDir = path.join(__dirname, "../data");
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      db = initializeDatabase(dataDir);
      elizaLogger.success("Database initialized successfully");
    } catch (error) {
      elizaLogger.error('Database initialization failed:', error);
      throw error;
    }

    try {
      character.id = stringToUuid(character.name);
      character.username = character.name;
      
      const token = getTokenForProvider(character.modelProvider, character);
      if (!token) {
        throw new Error(`No token found for model provider: ${character.modelProvider}`);
      }

      const cache = initializeDbCache(character, db);
      const runtime = createAgent(character, db, cache, token);
      await runtime.initialize();
      
      // Initialize clients
      runtime.clients = await initializeClients(character, runtime);

      // Start server
      const directClient = new DirectClient();
      directClient.registerAgent(runtime);
      const serverPort = parseInt(settings.SERVER_PORT || "3000");
      await directClient.start(serverPort);
      
      elizaLogger.log(`Agent ${character.name} started on port ${serverPort}`);
    } catch (error) {
      elizaLogger.error('Failed to initialize agent:', error);
      throw error;
    }
  } catch (error) {
    elizaLogger.error("Critical error:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    process.exit(1);
  }
}

startAgent().catch((error) => {
  elizaLogger.error("Unhandled error:", error);
  process.exit(1);
});