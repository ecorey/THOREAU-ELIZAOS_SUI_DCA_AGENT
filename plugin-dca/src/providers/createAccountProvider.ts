import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import { Aftermath } from "aftermath-ts-sdk";
import { toB64, fromB64 } from "@mysten/sui.js/utils";
import { SuiClient, SuiHTTPTransport } from "@mysten/sui.js/client";

const MAINNET_ENDPOINT = "https://fullnode.mainnet.sui.io";

const createAccountProvider: Provider = {
    get: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ): Promise<string> => {
        try {
            // Create SUI client
            const suiClient = new SuiClient({
                transport: new SuiHTTPTransport({
                    url: MAINNET_ENDPOINT
                })
            });

            // Initialize Aftermath SDK
            const afSdk = new Aftermath("MAINNET"); 
            await afSdk.init(); 
            const dca = afSdk.Dca();

            // Get wallet details from runtime settings
            const privateKey = runtime.getSetting("SUI_PRIVATE_KEY");
            if (!privateKey) {
                throw new Error("SUI_PRIVATE_KEY not configured in runtime settings");
            }

            // Create keypair from private key
            const suiAccount = Ed25519Keypair.fromSecretKey(fromB64(privateKey));
            const walletAddress = suiAccount.getPublicKey().toSuiAddress();

            console.log("Starting account creation for wallet:", walletAddress);

            try {
                // First check if the user already has a public key
                const existingPK = await dca.getUserPublicKey({
                    walletAddress
                });

                if (existingPK) {
                    return `DCA account already exists for wallet ${walletAddress}`;
                }

                // Generate message to sign
                const messageToSign = dca.createUserAccountMessageToSign();
                console.log("Generated message to sign:", messageToSign);

                // Sign the message
                const messageBytes = new TextEncoder().encode(JSON.stringify(messageToSign));
                const signatureData = await suiAccount.signPersonalMessage(messageBytes);

                // Create user account
                const success = await dca.createUserPublicKey({
                    walletAddress,
                    bytes: JSON.stringify(messageToSign),
                    signature: signatureData.signature
                });

                if (success) {
                    const response = `${runtime.character.name} successfully created DCA account for wallet ${walletAddress}`;
                    console.log(response);
                    return response;
                } else {
                    throw new Error("Failed to create DCA account - API call unsuccessful");
                }
            } catch (error) {
                console.error("DCA operation failed:", error);
                throw error;
            }
        } catch (error) {
            console.error("Account Provider Error:", error);
            return `Error creating Account: ${error.message}`;
        }
    }
};

export { createAccountProvider };