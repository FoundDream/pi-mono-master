import {
  createAgentSession,
  SessionManager,
  DefaultResourceLoader,
} from '@mariozechner/pi-coding-agent'
import { createModel } from '../../shared/model'

const model = createModel()

const resourceLoader = new DefaultResourceLoader({
  systemPromptOverride: () => 'You are a helpful assistant. Respond in detail.',
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

session.subscribe((event) => {
  if (event.type === 'message_update') {
    const { assistantMessageEvent } = event
    switch (assistantMessageEvent.type) {
      case 'text_delta':
        process.stdout.write(assistantMessageEvent.delta)
        break
    }
  }

  if (event.type === 'agent_start') {
    console.log('[Agent started thinking...]\n')
  }
  if (event.type === 'agent_end') {
    console.log('\n\n[Agent finished]')
  }
})

const question = process.argv[2] || 'Explain how a CPU executes instructions, step by step.'
console.log(`You: ${question}\n`)

await session.prompt(question)

console.log()
process.exit(0)
