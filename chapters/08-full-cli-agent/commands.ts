import type { AgentRuntime } from './runtime'
import type { SessionInfo } from '@mariozechner/pi-coding-agent'

let cachedSessions: SessionInfo[] = []

function printHelp() {
  console.log(`
Commands:
  /sessions   List all saved sessions
  /new        Start a new session
  /open <n>   Open session N from list
  /continue   Resume most recent session
  /abort      Abort current streaming
  /help       Show this help
  /quit       Exit
`)
}

export async function handleCommand(input: string, runtime: AgentRuntime): Promise<boolean> {
  if (!input.startsWith('/')) return false

  const [cmd, ...args] = input.split(' ')

  switch (cmd) {
    case '/help':
      printHelp()
      return true

    case '/sessions': {
      cachedSessions = await runtime.listSessions()
      if (cachedSessions.length === 0) {
        console.log('  No saved sessions.\n')
      } else {
        cachedSessions.forEach((s, i) => {
          const name = s.name || s.firstMessage.slice(0, 50) || '(empty)'
          const date = s.modified.toLocaleDateString()
          console.log(`  ${i + 1}. [${s.messageCount} msgs, ${date}] ${name}`)
        })
        console.log()
      }
      return true
    }

    case '/new':
      await runtime.newSession()
      return true

    case '/open': {
      const idx = parseInt(args[0]) - 1
      if (cachedSessions[idx]) {
        await runtime.openSession(cachedSessions[idx].path)
      } else {
        console.log('Invalid session number. Run /sessions first.\n')
      }
      return true
    }

    case '/continue':
      await runtime.continueRecentSession()
      return true

    case '/abort':
      runtime.abort()
      console.log('🛑 Aborted.\n')
      return true

    case '/quit':
      runtime.destroy()
      process.exit(0)

    default:
      console.log(`Unknown command: ${cmd}. Type /help for available commands.\n`)
      return true
  }
}
