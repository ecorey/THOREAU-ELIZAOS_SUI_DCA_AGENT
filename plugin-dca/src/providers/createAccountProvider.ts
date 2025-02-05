// createAccountProvider.ts
import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import { Aftermath } from "aftermath-ts-sdk";
import { fromB64 } from "@mysten/sui.js/utils";

interface AccountCreationState extends State {
  walletAddress?: string;
  privateKey?: string;
  success?: boolean;
}

const createAccountProvider: Provider = {
    get: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: AccountCreationState
    ): Promise<string> => {
        try {
            const privateKey = process.env.SUI_PRIVATE_KEY;
            if (!privateKey) throw new Error("No private key configured");

            const afSdk = new Aftermath("MAINNET"); 
            await afSdk.init(); 
            const dca = afSdk.Dca();

            const suiAccount = Ed25519Keypair.fromSecretKey(fromB64(privateKey));
            const walletAddress = suiAccount.getPublicKey().toSuiAddress();

            // Check existing account
            const existingPK = await dca.getUserPublicKey({ walletAddress });
            if (existingPK) return "EXISTS";

            const messageToSign = dca.createUserAccountMessageToSign();
            const messageBytes = new TextEncoder().encode(JSON.stringify(messageToSign));
            const signatureData = await suiAccount.signPersonalMessage(messageBytes);

            const success = await dca.createUserPublicKey({
                walletAddress,
                bytes: JSON.stringify(messageToSign),
                signature: signatureData.signature
            });

            return success ? "SUCCESS" : "FAILED";

        } catch (error) {
            console.error("Account Provider Error:", error);
            return `ERROR:${error.message}`;
        }
    }
};

export { createAccountProvider };