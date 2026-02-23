import {
  createAgentSession,
  SessionManager,
  DefaultResourceLoader,
} from "@mariozechner/pi-coding-agent";
import { createModel } from "../../shared/model";
import { weatherTool, calculatorTool } from "./tools";

const model = createModel();

const resourceLoader = new DefaultResourceLoader({
  systemPromptOverride: () =>
    "You are a helpful assistant with access to tools. Be concise.",
  noExtensions: true,
  noSkills: true,
  noPromptTemplates: true,
  noThemes: true,
});
await resourceLoader.reload();

const { session } = await createAgentSession({
  model,
  tools: [],
  customTools: [weatherTool, calculatorTool],
  sessionManager: SessionManager.inMemory(),
  resourceLoader,
});

session.subscribe((event) => {
  switch (event.type) {
    case "message_update":
      if (event.assistantMessageEvent.type === "text_delta") {
        process.stdout.write(event.assistantMessageEvent.delta);
      }
      break;

    case "tool_execution_start":
      console.log(
        `\n🔧 Tool call: ${event.toolName}(${JSON.stringify(event.args)})`,
      );
      break;

    case "tool_execution_end":
      console.log(`✅ Result: ${JSON.stringify(event.result)}\n`);
      break;
  }
});

const question =
  process.argv[2] || "What's the weather in Tokyo? Also, what is 42 * 17?";
console.log(`You: ${question}\n`);

await session.prompt(question);

console.log();
process.exit(0);
