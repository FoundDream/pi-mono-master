import {
  createAgentSession,
  SessionManager,
  DefaultResourceLoader,
} from '@mariozechner/pi-coding-agent'
import { createModel } from '../../shared/model'

const model = createModel()

const resourceLoader = new DefaultResourceLoader({
  systemPromptOverride: () => 'You are a helpful assistant. Be concise.',
  noExtensions: true,
  noSkills: true,
  noPromptTemplates: true,
  noThemes: true,
})
await resourceLoader.reload()

const { session } = await createAgentSession({
  model,
  tools: [],
  customTools: [],
  sessionManager: SessionManager.inMemory(),
  resourceLoader,
})

let response = ''
session.subscribe((event) => {
  if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
    response += event.assistantMessageEvent.delta
  }
})

await session.prompt('What is the Fibonacci sequence? Explain in 2 sentences.')

console.log('Agent:', response)
process.exit(0)
