import { Plugin } from "@elizaos/core";
import transferToken from "./actions/transfer";
import { WalletProvider, walletProvider } from "./providers/wallet";



// DEXSCREENER
import { dexscreenerProvider } from "./providers/dexscreenerProvider";
import dexscreenerCall from "./actions/dexscreenerCall";




export { WalletProvider, transferToken as TransferSuiToken };

export const suiPlugin: Plugin = {
    name: "sui",
    description: "Sui Plugin for Eliza",
    actions: [
        transferToken,
        dexscreenerCall,
        
    ],
    evaluators: [],
    providers: [
        walletProvider,
        dexscreenerProvider,
        
    ],
};

export default suiPlugin;