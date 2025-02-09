// eggCheckProvider.ts
import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import { SuiClient } from "@firefly-exchange/library-sui";
import { Ed25519Keypair } from "@firefly-exchange/library-sui";

export interface EggCheckState extends State {
  // No need for walletAddress since we'll use the env var
}

export const eggOwnershipProvider: Provider = {
  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: EggCheckState
  ): Promise<string> => {
    try {
      const client = new SuiClient({ url: "https://fullnode.mainnet.sui.io:443" });
      
      // Get private key from environment variable
      const privateKeyArray = process.env.SUI_PRIVATE_KEY_VAR?.split(",").map(Number);
      if (!privateKeyArray) {
        throw new Error("Private key not configured");
      }

      // Create keypair and get wallet address
      const keyPair = Ed25519Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
      const walletAddress = keyPair.toSuiAddress();
      
      // Query parameters for the specific egg type
      const query = {
        filter: {
          MatchAll: [
            {
              StructType: "0x484932c474bf09f002b82e4a57206a6658a0ca6dbdb15896808dcd1929c77820::egg::AfEgg"
            },
            {
              AddressOwner: walletAddress
            }
          ]
        },
        options: {
          showType: true,
          showOwner: true
        }
      };

      // Query owned objects
      const response = await client.getOwnedObjects({
        owner: walletAddress,
        filter: query.filter,
        options: query.options
      });

      const ownsEgg = response.data.length > 0;
      
      return JSON.stringify({
        success: true,
        ownsEgg,
        count: response.data.length,
        walletAddress // Include for logging/verification
      });

    } catch (error: any) {
      console.error("Egg Ownership Provider Error:", error);
      return JSON.stringify({
        success: false,
        error: error.message,
        details: error
      });
    }
  }
};