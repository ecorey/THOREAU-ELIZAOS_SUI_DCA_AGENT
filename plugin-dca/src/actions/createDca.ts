import { ActionExample, HandlerCallback, IAgentRuntime, Memory, elizaLogger, Action } from "@elizaos/core";
import { dcaProvider } from "../providers/dcaProvider.ts";

function parseTime(str: string): number {
  const match = str.match(/(\d+)\s*(week|day|hour|minute|min|hr|d|w|h|m)s?/i);
  if (!match) return 24 * 60 * 60 * 1000; // default: 1 day

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers: { [key: string]: number } = {
    week: 7 * 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    hour: 60 * 60 * 1000,
    hr: 60 * 60 * 1000,
    h: 60 * 60 * 1000,
    minute: 60 * 1000,
    min: 60 * 1000,
    m: 60 * 1000,
  };
  return value * (multipliers[unit] || multipliers.day);
}

export default {
  name: "CREATE_DCA_ORDER",
  description: "Create a DCA order by building + broadcasting the transaction",

  validate: async (_runtime: IAgentRuntime, _message: Memory) => true,

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state,
    _options,
    callback?: HandlerCallback
  ): Promise<boolean> => {
    elizaLogger.log("[CREATE_DCA_ORDER] Handler triggered...");

    try {
      if (message.content) {
        const content = message.content as any;
        const text = content.text as string;

        const amountMatch = text.match(/\$(\d+(\.\d+)?)/);
        const amount = amountMatch ? parseFloat(amountMatch[1]) : 4;
        const allocateAmount = BigInt(Math.round(amount * 1_000_000));

        const frequencyMatch = text.match(/every (\d+)\s*(week|day|hour|minute|min|hr|d|w|h|m)s?/i);
        const frequencyMs = frequencyMatch
          ? parseTime(`${frequencyMatch[1]} ${frequencyMatch[2]}`)
          : 24 * 60 * 60 * 1000;

        const tradesMatch = text.match(/(\d+)\s*trades/i);
        const trades = tradesMatch ? parseInt(tradesMatch[1], 10) : 2;

        const minPriceMatch = text.match(/min price(?: of)?\s*\$(\d+(\.\d+)?)/i);
        const maxPriceMatch = text.match(/max price(?: of)?\s*\$(\d+(\.\d+)?)/i);
        const minPrice = minPriceMatch
          ? BigInt(Math.round(parseFloat(minPriceMatch[1]) * 1_000_000_000))
          : BigInt(10);
        const maxPrice = maxPriceMatch
          ? BigInt(Math.round(parseFloat(maxPriceMatch[1]) * 1_000_000_000))
          : BigInt(1_000_000);

        state.dcaParams = {
          frequencyMs,
          tradesAmount: trades,
          delayTimeMs: 0,
          allocateAmount, 
          strategy: {
            minPrice, 
            maxPrice, 
          },
        };

        console.log("[DCAAction] Parsed parameters:", {
          frequencyMs,
          tradesAmount: trades,
          allocateAmount: allocateAmount.toString(),
          minPrice: minPrice.toString(),
          maxPrice: maxPrice.toString(),
        });
      }

      const setupResult = await dcaProvider.get(runtime, message, state);
      if (!setupResult.startsWith("SUCCESS")) {
        throw new Error(setupResult);
      }

      const dcaResult = await dcaProvider.createDcaOrder(runtime, message, state);

      // creates memory for the result
      const newMemoryDcaData: Memory = {
        userId: message.userId,
        agentId: message.agentId,
        roomId: message.roomId,
        content: {
            text: dcaResult,
            action: "CREATE_DCA_ORDER",
            source: message.content?.source,
        },
      };

      callback(newMemoryDcaData.content);


      if (callback) {
        if (dcaResult.startsWith("SUCCESS")) {
          callback({
            text: `✅ ${dcaResult}`,
            content: { status: "ok" },
          });
        } else {
          callback({
            text: `❌ DCA Order Creation Failed: ${dcaResult}`,
            content: { error: dcaResult },
          });
        }
      }
      return dcaResult.startsWith("SUCCESS");
    } catch (error: any) {
      elizaLogger.error("[CREATE_DCA_ORDER] error:", error);
      if (callback) {
        callback({
          text: `❌ DCA order creation error: ${error.message}`,
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
          text:
            "can you please create a DCA order for $4 USDC every 3 weeks for 2 trades with min price $0.25 and max price $10.50",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "✅ DCA Order created",
          action: "CREATE_DCA_ORDER",
        },
      },
    ],
  ] as ActionExample[][],
} as Action;
