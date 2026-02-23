import * as path from 'node:path'
import * as readline from 'node:readline'
import {
  createAgentSession,
  SessionManager,
  DefaultResourceLoader,
  type AgentSession,
  type SessionInfo,
} from '@mariozechner/pi-coding-agent'
import { createModel } from '../../shared/model'

const SESSION_DIR = path.join(import.meta.dirname, '.sessions')
const model = createModel()

// --- Helpers ---

async function createResourceLoader() {
  const rl = new DefaultResourceLoader({
    systemPromptOverride: () => 'You are a helpful assistant. Be concise.',
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
  })
  await rl.reload()
  return rl
}

async function buildSession(sm: SessionManager): Promise<AgentSession> {
  const resourceLoader = await createResourceLoader()
  const { session } = await createAgentSession({
    model,
    tools: [],
    customTools: [],
    sessionManager: sm,
    resourceLoader,
  })
  session.subscribe((event) => {
    if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
      process.stdout.write(event.assistantMessageEvent.delta)
    }
  })
  return session
}

// --- State ---

let sessionManager = SessionManager.create(process.cwd(), SESSION_DIR)
let session = await buildSession(sessionManager)
let cachedSessions: SessionInfo[] = []

// --- REPL with commands ---

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

console.log('Multi-session agent. Commands: /sessions, /new, /open <n>, /quit\n')

const ask = () => {
  rl.question('You: ', async (input) => {
    const trimmed = input.trim()

    if (trimmed === '/sessions') {
      cachedSessions = await SessionManager.list(process.cwd(), SESSION_DIR)
      if (cachedSessions.length === 0) {
        console.log('  No saved sessions.\n')
      } else {
        cachedSessions.forEach((s, i) => {
          const name = s.name || s.firstMessage.slice(0, 50) || '(empty)'
          console.log(`  ${i + 1}. [${s.messageCount} msgs] ${name}`)
        })
        console.log()
      }
      ask(); return
    }

    if (trimmed === '/new') {
      session.dispose()
      sessionManager = SessionManager.create(process.cwd(), SESSION_DIR)
      session = await buildSession(sessionManager)
      console.log('📝 New session created\n')
      ask(); return
    }

    if (trimmed.startsWith('/open ')) {
      const idx = parseInt(trimmed.split(' ')[1]) - 1
      if (cachedSessions[idx]) {
        session.dispose()
        sessionManager = SessionManager.open(cachedSessions[idx].path, SESSION_DIR)
        session = await buildSession(sessionManager)
        console.log(`📂 Opened session ${idx + 1}\n`)
      } else {
        console.log('Invalid session number. Run /sessions first.\n')
      }
      ask(); return
    }

    if (trimmed === '/quit') { rl.close(); process.exit(0) }
    if (!trimmed) { ask(); return }

    process.stdout.write('\nAgent: ')
    await session.prompt(trimmed)
    console.log('\n')
    ask()
  })
}

ask()
