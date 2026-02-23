import { Type } from "@sinclair/typebox";
import {
  createAgentSession,
  SessionManager,
  DefaultResourceLoader,
  type ToolDefinition,
} from "@mariozechner/pi-coding-agent";
import { createModel } from "../../shared/model";

const model = createModel();

// --- Confirmation Waiter ---

function createConfirmationWaiter() {
  let pendingResolve: ((v: { confirmed: boolean }) => void) | null = null;

  const waiter = (): Promise<{ confirmed: boolean }> =>
    new Promise((resolve) => {
      pendingResolve = resolve;
    });

  const stdinListener = (data: Buffer) => {
    if (pendingResolve) {
      const input = data.toString().trim().toLowerCase();
      const confirmed = input === "y" || input === "yes";
      pendingResolve({ confirmed });
      pendingResolve = null;
    }
  };
  process.stdin.on("data", stdinListener);

  return { waiter, cleanup: () => process.stdin.off("data", stdinListener) };
}

// --- Confirmed Tools ---

function createDeleteFileTool(
  waitForConfirmation: () => Promise<{ confirmed: boolean }>,
): ToolDefinition {
  return {
    name: "delete_file",
    label: "Delete File",
    description:
      "Delete a file at the given path. This is irreversible and requires user confirmation.",
    parameters: Type.Object({
      path: Type.String({ description: "File path to delete" }),
      reason: Type.String({ description: "Why this file should be deleted" }),
    }),
    execute: async (_toolCallId, params) => {
      const { path, reason } = params as { path: string; reason: string };

      console.log(`\n⚠️  Agent wants to delete: ${path}`);
      console.log(`   Reason: ${reason}`);
      console.log("   Confirm? [y/N]");

      const { confirmed } = await waitForConfirmation();

      if (!confirmed) {
        console.log("   ❌ Cancelled by user\n");
        return {
          content: [
            { type: "text" as const, text: "User cancelled the deletion." },
          ],
          details: {},
        };
      }

      console.log(`   ✅ Deleted (simulated)\n`);
      return {
        content: [
          { type: "text" as const, text: `Successfully deleted ${path}` },
        ],
        details: {},
      };
    },
  };
}

function createSendEmailTool(
  waitForConfirmation: () => Promise<{ confirmed: boolean }>,
): ToolDefinition {
  return {
    name: "send_email",
    label: "Send Email",
    description:
      "Send an email to the given address. Requires user confirmation.",
    parameters: Type.Object({
      to: Type.String({ description: "Recipient email address" }),
      subject: Type.String({ description: "Email subject" }),
      body: Type.String({ description: "Email body text" }),
    }),
    execute: async (_toolCallId, params) => {
      const { to, subject, body } = params as {
        to: string;
        subject: string;
        body: string;
      };

      console.log(`\n📧 Agent wants to send email:`);
      console.log(`   To: ${to}`);
      console.log(`   Subject: ${subject}`);
      console.log(`   Body: ${body.slice(0, 100)}...`);
      console.log("   Confirm? [y/N]");

      const { confirmed } = await waitForConfirmation();

      if (!confirmed) {
        console.log("   ❌ Cancelled by user\n");
        return {
          content: [
            { type: "text" as const, text: "User cancelled the email." },
          ],
          details: {},
        };
      }

      console.log(`   ✅ Email sent (simulated)\n`);
      return {
        content: [{ type: "text" as const, text: `Email sent to ${to}` }],
        details: {},
      };
    },
  };
}

// --- Main ---

const { waiter, cleanup } = createConfirmationWaiter();

const resourceLoader = new DefaultResourceLoader({
  systemPromptOverride: () =>
    "You are a helpful assistant. You can delete files and send emails, but these actions require user confirmation.",
  noExtensions: true,
  noSkills: true,
  noPromptTemplates: true,
  noThemes: true,
});
await resourceLoader.reload();

const { session } = await createAgentSession({
  model,
  tools: [],
  customTools: [createDeleteFileTool(waiter), createSendEmailTool(waiter)],
  sessionManager: SessionManager.inMemory(),
  resourceLoader,
});

session.subscribe((event) => {
  if (
    event.type === "message_update" &&
    event.assistantMessageEvent.type === "text_delta"
  ) {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
  if (event.type === "tool_execution_start") {
    console.log(`\n🔧 ${event.toolName}(${JSON.stringify(event.args)})`);
  }
  if (event.type === "tool_execution_end") {
    console.log(`✅ Done\n`);
  }
});

const question =
  process.argv[2] ||
  "Delete the file /tmp/old-backup.log because it is outdated";
console.log(`You: ${question}\n`);
process.stdout.write("Agent: ");

try {
  await session.prompt(question);
} catch (error) {
  console.error(
    "\nError:",
    error instanceof Error ? error.message : String(error),
  );
}

console.log();
cleanup();
process.exit(0);
