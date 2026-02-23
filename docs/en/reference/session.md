---
title: Session File Format
---

# Session File Format

Sessions are stored as append-only JSONL (JSON Lines) files. Each line is a self-contained JSON object representing either the session header or a session entry.

## File Location

Sessions are stored at:

```
~/.pi/agent/sessions/--<encoded-cwd>--/<timestamp>_<uuid>.jsonl
```

The `<encoded-cwd>` is the working directory path with path separators replaced by `--`. For example, a project at `/home/user/my-project` would store sessions in `~/.pi/agent/sessions/--home--user--my-project--/`.

## Session Versions

| Version | Description                                                    |
| ------- | -------------------------------------------------------------- |
| v1      | Original format (no `id`/`parentId` fields)                    |
| v2      | Added tree structure with `id`/`parentId`                      |
| v3      | Current version, adds `custom_message` and `label` entry types |

The current version is exported as `CURRENT_SESSION_VERSION` (value: `3`). Old sessions are automatically migrated when loaded.

## Content Block Types

Content blocks are the building blocks of messages. They appear in the `content` arrays of user and assistant messages.

### TextContent

```typescript
interface TextContent {
  type: "text";
  text: string;
  textSignature?: string;
}
```

### ImageContent

```typescript
interface ImageContent {
  type: "image";
  data: string; // base64-encoded image data
  mimeType: string; // e.g., "image/png", "image/jpeg"
}
```

### ThinkingContent

```typescript
interface ThinkingContent {
  type: "thinking";
  thinking: string;
  thinkingSignature?: string;
}
```

### ToolCall

```typescript
interface ToolCall {
  type: "toolCall";
  id: string;
  name: string;
  arguments: Record<string, any>;
  thoughtSignature?: string;
}
```

## Base Message Types

These are the standard LLM message types defined in `@mariozechner/pi-ai`.

### UserMessage

```typescript
interface UserMessage {
  role: "user";
  content: string | (TextContent | ImageContent)[];
  timestamp: number;
}
```

### AssistantMessage

```typescript
interface AssistantMessage {
  role: "assistant";
  content: (TextContent | ThinkingContent | ToolCall)[];
  api: string; // e.g., "anthropic-messages", "openai-completions"
  provider: string; // e.g., "anthropic", "openai"
  model: string; // e.g., "claude-sonnet-4-20250514"
  usage: Usage;
  stopReason: "stop" | "length" | "toolUse" | "error" | "aborted";
  errorMessage?: string;
  timestamp: number;
}

interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
}
```

### ToolResultMessage

```typescript
interface ToolResultMessage<TDetails = any> {
  role: "toolResult";
  toolCallId: string;
  toolName: string;
  content: (TextContent | ImageContent)[];
  details?: TDetails;
  isError: boolean;
  timestamp: number;
}
```

## Extended Message Types

The coding agent extends the base `AgentMessage` union with custom message types via declaration merging.

### BashExecutionMessage

Represents a bash command executed via the `!` or `!!` prefix in interactive mode.

```typescript
interface BashExecutionMessage {
  role: "bashExecution";
  command: string;
  output: string;
  exitCode: number | undefined;
  cancelled: boolean;
  truncated: boolean;
  fullOutputPath?: string;
  timestamp: number;
  /** If true, this message is excluded from LLM context (!!) */
  excludeFromContext?: boolean;
}
```

### CustomMessage

Extension-injected messages via `sendCustomMessage()`.

```typescript
interface CustomMessage<T = unknown> {
  role: "custom";
  customType: string;
  content: string | (TextContent | ImageContent)[];
  display: boolean; // true = rendered in TUI, false = hidden
  details?: T;
  timestamp: number;
}
```

### BranchSummaryMessage

Generated when navigating the session tree with summarization enabled.

```typescript
interface BranchSummaryMessage {
  role: "branchSummary";
  summary: string;
  fromId: string;
  timestamp: number;
}
```

### CompactionSummaryMessage

Generated when context compaction occurs.

```typescript
interface CompactionSummaryMessage {
  role: "compactionSummary";
  summary: string;
  tokensBefore: number;
  timestamp: number;
}
```

### AgentMessage Union

The full message union type:

```typescript
type Message = UserMessage | AssistantMessage | ToolResultMessage;

type AgentMessage =
  | Message
  | BashExecutionMessage
  | CustomMessage
  | BranchSummaryMessage
  | CompactionSummaryMessage;
```

## Session Entry Types

Every session entry (except the header) extends `SessionEntryBase`:

```typescript
interface SessionEntryBase {
  type: string;
  id: string; // UUID for this entry
  parentId: string | null; // UUID of parent entry (null for root)
  timestamp: string; // ISO 8601 timestamp
}
```

### SessionHeader

The first line of every session file. Not a session entry (no `id`/`parentId`).

```typescript
interface SessionHeader {
  type: "session";
  version?: number; // Current: 3
  id: string; // Session UUID
  timestamp: string;
  cwd: string; // Working directory
  parentSession?: string; // Path to parent session (for forks)
}
```

Example:

```json
{
  "type": "session",
  "version": 3,
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "cwd": "/home/user/project"
}
```

### SessionMessageEntry

Wraps any `AgentMessage` (user, assistant, tool result, bash execution, custom, etc.).

```typescript
interface SessionMessageEntry extends SessionEntryBase {
  type: "message";
  message: AgentMessage;
}
```

Example (user message):

```json
{
  "type": "message",
  "id": "uuid-1",
  "parentId": null,
  "timestamp": "2025-01-15T10:30:01.000Z",
  "message": {
    "role": "user",
    "content": "What files are in the current directory?",
    "timestamp": 1705312201000
  }
}
```

Example (assistant message):

```json
{
  "type": "message",
  "id": "uuid-2",
  "parentId": "uuid-1",
  "timestamp": "2025-01-15T10:30:02.000Z",
  "message": {
    "role": "assistant",
    "content": [
      { "type": "text", "text": "Let me check..." },
      {
        "type": "toolCall",
        "id": "tc-1",
        "name": "bash",
        "arguments": { "command": "ls -la" }
      }
    ],
    "api": "anthropic-messages",
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "usage": {
      "input": 100,
      "output": 50,
      "cacheRead": 0,
      "cacheWrite": 0,
      "totalTokens": 150,
      "cost": {
        "input": 0.001,
        "output": 0.0005,
        "cacheRead": 0,
        "cacheWrite": 0,
        "total": 0.0015
      }
    },
    "stopReason": "toolUse",
    "timestamp": 1705312202000
  }
}
```

Example (tool result):

```json
{
  "type": "message",
  "id": "uuid-3",
  "parentId": "uuid-2",
  "timestamp": "2025-01-15T10:30:03.000Z",
  "message": {
    "role": "toolResult",
    "toolCallId": "tc-1",
    "toolName": "bash",
    "content": [
      {
        "type": "text",
        "text": "total 42\ndrwxr-xr-x  5 user user 4096 Jan 15 10:00 .\n..."
      }
    ],
    "isError": false,
    "timestamp": 1705312203000
  }
}
```

### ModelChangeEntry

Records when the user switches models.

```typescript
interface ModelChangeEntry extends SessionEntryBase {
  type: "model_change";
  provider: string;
  modelId: string;
}
```

Example:

```json
{
  "type": "model_change",
  "id": "uuid-4",
  "parentId": "uuid-3",
  "timestamp": "2025-01-15T10:31:00.000Z",
  "provider": "openai",
  "modelId": "gpt-4o"
}
```

### ThinkingLevelChangeEntry

Records when the thinking level is changed.

```typescript
interface ThinkingLevelChangeEntry extends SessionEntryBase {
  type: "thinking_level_change";
  thinkingLevel: string;
}
```

Example:

```json
{
  "type": "thinking_level_change",
  "id": "uuid-5",
  "parentId": "uuid-4",
  "timestamp": "2025-01-15T10:31:01.000Z",
  "thinkingLevel": "high"
}
```

### CompactionEntry

Created when context compaction occurs. Stores the summary and metadata.

```typescript
interface CompactionEntry<T = unknown> extends SessionEntryBase {
  type: "compaction";
  summary: string;
  firstKeptEntryId: string; // UUID of first entry kept after compaction
  tokensBefore: number; // Token count before compaction
  /** Extension-specific data (e.g., file tracking) */
  details?: T;
  /** True if generated by an extension, undefined/false if pi-generated */
  fromHook?: boolean;
}
```

The default `details` type for pi-generated compaction entries:

```typescript
interface CompactionDetails {
  readFiles: string[];
  modifiedFiles: string[];
}
```

Example:

```json
{
  "type": "compaction",
  "id": "uuid-10",
  "parentId": "uuid-9",
  "timestamp": "2025-01-15T11:00:00.000Z",
  "summary": "## Goal\nImplement user authentication...\n## Progress\n- Created login form...",
  "firstKeptEntryId": "uuid-8",
  "tokensBefore": 50000,
  "details": {
    "readFiles": ["src/auth.ts"],
    "modifiedFiles": ["src/login.tsx", "src/api/auth.ts"]
  }
}
```

### BranchSummaryEntry

Created when navigating the session tree with summarization enabled. Captures context from the abandoned branch.

```typescript
interface BranchSummaryEntry<T = unknown> extends SessionEntryBase {
  type: "branch_summary";
  fromId: string; // Entry ID where the branch was abandoned
  summary: string;
  /** Extension-specific data (not sent to LLM) */
  details?: T;
  /** True if generated by an extension, false if pi-generated */
  fromHook?: boolean;
}
```

The default `details` type:

```typescript
interface BranchSummaryDetails {
  readFiles: string[];
  modifiedFiles: string[];
}
```

Example:

```json
{
  "type": "branch_summary",
  "id": "uuid-15",
  "parentId": "uuid-5",
  "timestamp": "2025-01-15T11:30:00.000Z",
  "fromId": "uuid-14",
  "summary": "## Goal\nRefactor database layer...\n## Progress\n- Extracted repository pattern...",
  "details": { "readFiles": ["src/db.ts"], "modifiedFiles": ["src/repo.ts"] }
}
```

### CustomEntry

Extension-specific data storage. Does NOT participate in LLM context. Used to persist extension state across session reloads.

```typescript
interface CustomEntry<T = unknown> extends SessionEntryBase {
  type: "custom";
  customType: string; // Extension identifier
  data?: T;
}
```

Example:

```json
{
  "type": "custom",
  "id": "uuid-20",
  "parentId": "uuid-19",
  "timestamp": "2025-01-15T12:00:00.000Z",
  "customType": "git-checkpoint",
  "data": { "commitHash": "abc123", "branch": "feature/auth" }
}
```

### CustomMessageEntry

Extension-injected messages that DO participate in LLM context. Converted to user messages in `buildSessionContext()`.

```typescript
interface CustomMessageEntry<T = unknown> extends SessionEntryBase {
  type: "custom_message";
  customType: string;
  content: string | (TextContent | ImageContent)[];
  details?: T; // Extension-specific metadata (not sent to LLM)
  display: boolean; // true = styled display in TUI, false = hidden
}
```

Example:

```json
{
  "type": "custom_message",
  "id": "uuid-21",
  "parentId": "uuid-20",
  "timestamp": "2025-01-15T12:01:00.000Z",
  "customType": "context-inject",
  "content": "The user prefers functional programming patterns.",
  "display": false
}
```

### LabelEntry

User-defined bookmark or marker on an entry.

```typescript
interface LabelEntry extends SessionEntryBase {
  type: "label";
  targetId: string; // Entry being labeled
  label: string | undefined; // Label text, or undefined to clear
}
```

Example:

```json
{
  "type": "label",
  "id": "uuid-22",
  "parentId": "uuid-21",
  "timestamp": "2025-01-15T12:02:00.000Z",
  "targetId": "uuid-10",
  "label": "checkpoint-before-refactor"
}
```

### SessionInfoEntry

Session metadata such as a user-defined display name.

```typescript
interface SessionInfoEntry extends SessionEntryBase {
  type: "session_info";
  name?: string;
}
```

Example:

```json
{
  "type": "session_info",
  "id": "uuid-23",
  "parentId": "uuid-22",
  "timestamp": "2025-01-15T12:03:00.000Z",
  "name": "Auth feature implementation"
}
```

## SessionEntry Union

```typescript
type SessionEntry =
  | SessionMessageEntry
  | ThinkingLevelChangeEntry
  | ModelChangeEntry
  | CompactionEntry
  | BranchSummaryEntry
  | CustomEntry
  | CustomMessageEntry
  | LabelEntry
  | SessionInfoEntry;

/** Raw file entry (includes header) */
type FileEntry = SessionHeader | SessionEntry;
```

## Tree Structure

Sessions form a tree via `id` and `parentId` fields. Each entry is a child of its parent, enabling branching:

```
                    root (parentId: null)
                    [user: "Help me build an API"]
                   /                              \
           uuid-2                                 uuid-7
     [assistant: "I'll help..."]           [assistant: "Let me..."]
           |                                      |
           uuid-3                                 uuid-8
     [user: "Use Express"]                 [user: "Use Fastify"]
           |                                      |
           uuid-4                                 uuid-9  <-- current leaf
     [assistant: "Setting up..."]          [assistant: "Setting up..."]
           |
           uuid-5
     [compaction: summary of above]
           |
           uuid-6
     [user: "Add authentication"]
```

Key concepts:

- **Root entry**: The first entry has `parentId: null`
- **Leaf pointer**: Tracks the current position in the tree. New entries are always appended as children of the current leaf.
- **Branching**: Moving the leaf to an earlier entry creates a branch. The next append creates a new child of that entry, diverging from the original path.
- **Append-only**: Entries are never modified or deleted. History is immutable.

## Context Building

`buildSessionContext()` reconstructs the LLM context by walking from the current leaf to the root:

1. Walk from the leaf entry up to the root, collecting all entries along the path
2. If a `CompactionEntry` is found along the path, inject the compaction summary as a `CompactionSummaryMessage` and skip all entries before `firstKeptEntryId`
3. If a `BranchSummaryEntry` is found, inject the branch summary as a `BranchSummaryMessage`
4. Convert `SessionMessageEntry` entries to their contained `AgentMessage`
5. Convert `CustomMessageEntry` entries to user messages
6. Extract the latest `ModelChangeEntry` and `ThinkingLevelChangeEntry` from the path
7. Return the resolved `SessionContext`

```typescript
interface SessionContext {
  messages: AgentMessage[];
  thinkingLevel: string;
  model: { provider: string; modelId: string } | null;
}
```

## Parsing

```typescript
import { parseSessionEntries } from "@mariozechner/pi-coding-agent";
import { readFileSync } from "fs";

const content = readFileSync("/path/to/session.jsonl", "utf-8");
const entries: FileEntry[] = parseSessionEntries(content);

// First entry is always the header
const header = entries[0] as SessionHeader;
console.log("Session ID:", header.id);
console.log("Working directory:", header.cwd);

// Remaining entries are session entries
const sessionEntries = entries.slice(1) as SessionEntry[];
for (const entry of sessionEntries) {
  switch (entry.type) {
    case "message":
      console.log(
        `${entry.message.role}: ${JSON.stringify(entry.message.content).slice(0, 100)}`,
      );
      break;
    case "compaction":
      console.log(`Compaction: ${entry.tokensBefore} tokens summarized`);
      break;
    case "model_change":
      console.log(`Model changed to ${entry.provider}/${entry.modelId}`);
      break;
  }
}
```

## SessionManager API

### Static Creation Methods

```typescript
// Create a new session with file persistence
const sm = SessionManager.create(cwd: string, sessionDir?: string);

// Open an existing session file
const sm = SessionManager.open(path: string, sessionDir?: string);

// Continue the most recent session, or create new if none
const sm = SessionManager.continueRecent(cwd: string, sessionDir?: string);

// Create an in-memory session (no file persistence)
const sm = SessionManager.inMemory(cwd?: string);

// Fork from another project's session into the current project
const sm = SessionManager.forkFrom(sourcePath: string, targetCwd: string, sessionDir?: string);
```

### Static Listing

```typescript
// List sessions for a specific directory
const sessions: SessionInfo[] = await SessionManager.list(cwd, sessionDir?, onProgress?);

// List all sessions across all project directories
const allSessions: SessionInfo[] = await SessionManager.listAll(onProgress?);
```

`SessionInfo` contains:

```typescript
interface SessionInfo {
  path: string;
  id: string;
  cwd: string; // Working directory
  name?: string; // User-defined display name
  parentSessionPath?: string; // Parent session (if forked)
  created: Date;
  modified: Date;
  messageCount: number;
  firstMessage: string;
  allMessagesText: string;
}
```

### Instance Methods - Management

```typescript
sm.newSession(options?: { parentSession?: string }); // Start a new session
sm.setSessionFile(sessionFile: string);               // Switch to a different file
sm.isPersisted(): boolean;                             // Whether this session is persisted to disk
sm.getCwd(): string;                                   // Get working directory
sm.getSessionDir(): string;                             // Get session directory
sm.getSessionId(): string;                              // Get session UUID
sm.getSessionFile(): string | undefined;                // Get session file path
sm.getSessionName(): string | undefined;                // Get display name
```

### Instance Methods - Appending

```typescript
sm.appendMessage(message): string;                                   // Append a message entry
sm.appendThinkingLevelChange(thinkingLevel: string): string;        // Record thinking level change
sm.appendModelChange(provider: string, modelId: string): string;    // Record model change
sm.appendCompaction(summary, firstKeptEntryId, tokensBefore, details?, fromHook?): string;
sm.appendCustomEntry(customType: string, data?: unknown): string;
sm.appendCustomMessageEntry(customType, content, display, details?): string;
sm.appendSessionInfo(name: string): string;
sm.appendLabelChange(targetId: string, label: string | undefined): string;
```

All append methods return the new entry's UUID and advance the leaf pointer.

### Instance Methods - Tree Navigation

```typescript
sm.getLeafId(): string | null;                         // Current leaf entry UUID
sm.getLeafEntry(): SessionEntry | undefined;           // Current leaf entry
sm.getEntry(id: string): SessionEntry | undefined;     // Get entry by UUID
sm.getChildren(parentId: string): SessionEntry[];      // Get direct children
sm.getLabel(id: string): string | undefined;           // Get label for entry
sm.getBranch(fromId?: string): SessionEntry[];         // Walk from entry to root
sm.getTree(): SessionTreeNode[];                        // Full tree structure
sm.branch(branchFromId: string): void;                 // Move leaf to earlier entry
sm.resetLeaf(): void;                                   // Reset leaf to before root
sm.branchWithSummary(id, summary, details?, fromHook?): string;
sm.createBranchedSession(leafId: string): string | undefined;
```

```typescript
interface SessionTreeNode {
  entry: SessionEntry;
  children: SessionTreeNode[];
  label?: string; // Resolved label, if any
}
```

### Instance Methods - Context

```typescript
sm.buildSessionContext(): SessionContext;               // Build LLM context from current leaf
sm.getHeader(): SessionHeader | null;                   // Get session header
sm.getEntries(): SessionEntry[];                        // Get all entries (shallow copy)
```
