import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import { Aftermath } from "aftermath-ts-sdk";

interface AccountCreationState extends State {
 walletAddress?: string;
 privateKey?: string;
 success?: boolean;
}

const createAccountProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: AccountCreationState): Promise<string> => {
        try {
            const privateKeyArray = process.env.SUI_PRIVATE_KEY_VAR.split(',').map(num => parseInt(num, 10));
            const suiAccount = Ed25519Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
            const walletAddress = suiAccount.getPublicKey().toSuiAddress();
            console.log("Created wallet:", walletAddress);

            const afSdk = new Aftermath("MAINNET"); 
            console.log("Created Aftermath SDK");
            
            await afSdk.init();
            console.log("Initialized SDK");
            
            const dca = afSdk.Dca();
            console.log("Got DCA module");

            const messageToSign = dca.createUserAccountMessageToSign();
            const messageJson = JSON.stringify(messageToSign, null, 2);
            console.log("Message to sign:", messageJson);

            const messageBytes = new TextEncoder().encode(messageJson);
            const signatureData = await suiAccount.signPersonalMessage(messageBytes);
            console.log("Signed message");



            // const response = await dca.createUserPublicKey({
            //     walletAddress,
            //     bytes: messageJson,
            //     signature: signatureData.signature
            // });
            // console.log("API response:", response);



            // return response ? "SUCCESS" : "FAILED";
        } catch (error) {
            console.error("Full error:", error);
            return `ERROR:${error.message}`;
        }
    }
};

export { createAccountProvider };