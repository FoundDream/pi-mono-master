import * as path from "node:path";
import * as readline from "node:readline";
import {
  createAgentSession,
  SessionManager,
  DefaultResourceLoader,
} from "@mariozechner/pi-coding-agent";
import { createModel } from "../../shared/model";

const SESSION_DIR = path.join(import.meta.dirname, ".sessions");
const model = createModel();

const arg = process.argv[2];

let sessionManager: SessionManager;
if (arg === "continue") {
  sessionManager = SessionManager.continueRecent(process.cwd(), SESSION_DIR);
  const ctx = sessionManager.buildSessionContext();
  console.log(`📂 Resumed session (${ctx.messages.length} previous messages)`);
  console.log(`   Session file: ${sessionManager.getSessionFile()}\n`);
} else {
  sessionManager = SessionManager.create(process.cwd(), SESSION_DIR);
  console.log("📝 New session created");
  console.log(`   Session file: ${sessionManager.getSessionFile()}\n`);
}

const resourceLoader = new DefaultResourceLoader({
  systemPromptOverride: () =>
    "You are a helpful assistant. Be concise. Remember our conversation context.",
  noExtensions: true,
  noSkills: true,
  noPromptTemplates: true,
  noThemes: true,
});
await resourceLoader.reload();

const { session } = await createAgentSession({
  model,
  tools: [],
  customTools: [],
  sessionManager,
  resourceLoader,
});

session.subscribe((event) => {
  if (
    event.type === "message_update" &&
    event.assistantMessageEvent.type === "text_delta"
  ) {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("Type your message (or /quit to exit):\n");

const ask = () => {
  rl.question("You: ", async (input) => {
    const trimmed = input.trim();
    if (trimmed === "/quit" || trimmed === "/exit") {
      console.log("\nGoodbye! Your session has been saved.");
      rl.close();
      process.exit(0);
    }
    if (!trimmed) {
      ask();
      return;
    }

    process.stdout.write("\nAgent: ");
    await session.prompt(trimmed);
    console.log("\n");
    ask();
  });
};

ask();
