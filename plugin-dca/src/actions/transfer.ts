import {
    ActionExample,
    Content,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
    elizaLogger,
    type Action,
} from "@elizaos/core";

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { SUI_DECIMALS } from "@mysten/sui/utils";

import { walletProvider } from "../providers/wallet";

type SuiNetwork = "mainnet" | "testnet" | "devnet" | "localnet";

// Simplified interface
interface TransferContent {
    recipient: string;
    amount: string | number;
}

export default {
    name: "SEND_TOKEN",
    similes: ["TRANSFER_TOKEN", "TRANSFER_TOKENS", "SEND_TOKENS", "SEND_SUI", "PAY"],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        console.log("Validating sui transfer from user:", message.userId);
        return true;
    },
    description: "Transfer tokens from the agent's wallet to another address",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.log("Starting SEND_TOKEN handler...");
        
        try {
            const walletInfo = await walletProvider.get(runtime, message, state);
            state.walletInfo = walletInfo;

            // Extract transfer details from message
            const messageText = message.content.text?.toLowerCase() || '';
            console.log("Processing message:", messageText);

            const addressMatch = messageText.match(/0x[a-fA-F0-9]{64}/);
            const amountMatch = messageText.match(/(\d+(\.\d+)?)\s*sui/i);

            if (!addressMatch || !amountMatch) {
                console.log("Could not extract transfer details:", { addressMatch, amountMatch });
                if (callback) {
                    callback({
                        text: "Could not determine transfer details. Please specify amount and address clearly.",
                        content: { error: "Invalid transfer details" },
                    });
                }
                return false;
            }

            const transferContent: TransferContent = {
                recipient: addressMatch[0],
                amount: amountMatch[1]
            };

            console.log("Transfer content extracted:", transferContent);

            // Execute transfer
            const privateKey = runtime.getSetting("SUI_PRIVATE_KEY");
            if (!privateKey) {
                throw new Error("SUI_PRIVATE_KEY not configured");
            }

            const suiAccount = Ed25519Keypair.deriveKeypair(privateKey);
            const network = runtime.getSetting("SUI_NETWORK") || "mainnet";
            const suiClient = new SuiClient({
                url: getFullnodeUrl(network as SuiNetwork),
            });

            const adjustedAmount = BigInt(
                Math.floor(Number(transferContent.amount) * Math.pow(10, SUI_DECIMALS))
            );
            
            console.log(`Transferring: ${transferContent.amount} SUI (${adjustedAmount} MIST)`);
            
            const tx = new Transaction();
            const [coin] = tx.splitCoins(tx.gas, [adjustedAmount]);
            tx.transferObjects([coin], transferContent.recipient);
            
            const executedTransaction = await suiClient.signAndExecuteTransaction({
                signer: suiAccount,
                transaction: tx,
            });

            console.log("Transfer successful:", executedTransaction.digest);

            if (callback) {
                callback({
                    text: `Successfully transferred ${transferContent.amount} SUI to ${transferContent.recipient}, Transaction: ${executedTransaction.digest}`,
                    content: {
                        success: true,
                        hash: executedTransaction.digest,
                        amount: transferContent.amount,
                        recipient: transferContent.recipient,
                    },
                });
            }

            return true;
        } catch (error) {
            console.error("Error during token transfer:", error);
            if (callback) {
                callback({
                    text: `Error transferring tokens: ${error.message}`,
                    content: { error: error.message },
                });
            }
            return false;
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Send 1 SUI tokens to 0x4f2e63be8e7fe287836e29cde6f3d5cbc96eefd0c0e3f3747668faa2ae7324b0",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll send 1 SUI tokens now...",
                    action: "SEND_TOKEN",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;