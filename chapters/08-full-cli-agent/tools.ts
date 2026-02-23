import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";

export const weatherTool: ToolDefinition = {
  name: "get_weather",
  label: "Get Weather",
  description:
    "Get current weather for a city. Use when the user asks about weather.",
  parameters: Type.Object({
    city: Type.String({ description: 'City name (e.g. "Tokyo", "London")' }),
  }),
  execute: async (_toolCallId, params) => {
    const { city } = params as { city: string };
    const data: Record<
      string,
      { temp: string; condition: string; humidity: string }
    > = {
      tokyo: { temp: "22°C", condition: "Sunny", humidity: "45%" },
      london: { temp: "14°C", condition: "Cloudy", humidity: "78%" },
      "new york": { temp: "18°C", condition: "Partly cloudy", humidity: "55%" },
    };
    const key = city.toLowerCase();
    const weather = data[key] || {
      temp: "20°C",
      condition: "Clear",
      humidity: "50%",
    };
    return {
      content: [
        { type: "text" as const, text: JSON.stringify({ city, ...weather }) },
      ],
      details: {},
    };
  },
};

export function createTimeTool(): ToolDefinition {
  return {
    name: "get_current_time",
    label: "Get Current Time",
    description:
      "Get the current date and time. Use when the user asks what time it is.",
    parameters: Type.Object({}),
    execute: async () => {
      return {
        content: [{ type: "text" as const, text: new Date().toISOString() }],
        details: {},
      };
    },
  };
}

export function createDangerousTool(
  waitForConfirmation: () => Promise<{ confirmed: boolean }>,
): ToolDefinition {
  return {
    name: "dangerous_operation",
    label: "Dangerous Operation",
    description:
      "Perform a potentially dangerous operation (e.g. delete a file, run a destructive command). Requires user confirmation.",
    parameters: Type.Object({
      operation: Type.String({
        description: "Description of the operation to perform",
      }),
      reason: Type.String({ description: "Why this operation is needed" }),
    }),
    execute: async (_toolCallId, params) => {
      const { operation, reason } = params as {
        operation: string;
        reason: string;
      };

      console.log(`\n⚠️  Dangerous operation requested:`);
      console.log(`   Operation: ${operation}`);
      console.log(`   Reason: ${reason}`);
      console.log("   Confirm? [y/N]");

      const { confirmed } = await waitForConfirmation();

      if (!confirmed) {
        console.log("   ❌ Cancelled by user\n");
        return {
          content: [
            { type: "text" as const, text: "User cancelled the operation." },
          ],
          details: {},
        };
      }

      console.log(`   ✅ Executed (simulated)\n`);
      return {
        content: [
          { type: "text" as const, text: `Operation completed: ${operation}` },
        ],
        details: {},
      };
    },
  };
}
