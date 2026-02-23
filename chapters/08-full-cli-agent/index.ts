import * as path from 'node:path'
import * as readline from 'node:readline'
import { createModel } from '../../shared/model'
import { AgentRuntime } from './runtime'
import { weatherTool, createTimeTool, createDangerousTool } from './tools'
import { handleCommand } from './commands'

const SESSION_DIR = path.join(import.meta.dirname, '.sessions')
const SKILLS_DIR = path.join(import.meta.dirname, 'skills')

const model = createModel()

const runtime = new AgentRuntime({
  model,
  cwd: process.cwd(),
  sessionDir: SESSION_DIR,
  skillsDir: SKILLS_DIR,
  systemPrompt: [
    'You are a versatile CLI assistant.',
    'You have access to tools for weather, time, file operations, and shell commands.',
    'Be concise but thorough. Use tools when appropriate rather than guessing.',
  ].join('\n'),
  customTools: [weatherTool, createTimeTool(), createDangerousTool(runtime.createConfirmationWaiter())],
  includeCodingTools: true,
})

// Ctrl+C to abort current generation
process.on('SIGINT', () => {
  runtime.abort()
  console.log('\n🛑 Aborted.')
})

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

console.log('🚀 Full CLI Agent ready. Type /help for commands.\n')

const ask = () => {
  rl.question('You: ', async (input) => {
    const trimmed = input.trim()
    if (!trimmed) { ask(); return }

    if (await handleCommand(trimmed, runtime)) {
      ask()
      return
    }

    await runtime.prompt(trimmed)
    ask()
  })
}

ask()
