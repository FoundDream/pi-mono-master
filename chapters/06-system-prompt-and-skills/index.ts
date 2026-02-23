import * as path from 'node:path'
import { Type } from '@sinclair/typebox'
import {
  createAgentSession,
  SessionManager,
  DefaultResourceLoader,
  loadSkillsFromDir,
  type ToolDefinition,
} from '@mariozechner/pi-coding-agent'
import { createModel } from '../../shared/model'

const model = createModel()

const SKILLS_DIR = path.join(import.meta.dirname, 'skills')
const { skills, diagnostics } = loadSkillsFromDir({ dir: SKILLS_DIR, source: 'tutorial' })

console.log(`📚 Loaded ${skills.length} skill(s):`)
skills.forEach((s) => console.log(`   - ${s.name}: ${s.description}`))

const weatherTool: ToolDefinition = {
  name: 'get_weather',
  label: 'Get Weather',
  description: 'Get current weather for a city.',
  parameters: Type.Object({
    city: Type.String({ description: 'City name' }),
  }),
  execute: async (_toolCallId, params) => {
    const { city } = params as { city: string }
    const data: Record<string, object> = {
      tokyo: { temp: '22°C', condition: 'Sunny', humidity: '45%', forecast: 'Clear skies' },
      london: { temp: '14°C', condition: 'Overcast', humidity: '82%', forecast: 'Rain expected' },
    }
    const weather = data[city.toLowerCase()] || { temp: '20°C', condition: 'Clear', humidity: '50%' }
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ city, ...weather }) }],
      details: {},
    }
  },
}

const resourceLoader = new DefaultResourceLoader({
  systemPromptOverride: () => [
    'You are WeatherBot, a friendly weather assistant.',
    'Always greet the user warmly.',
    'When asked about weather, use the get_weather tool first.',
  ].join('\n'),
  noExtensions: true,
  noPromptTemplates: true,
  noThemes: true,
  noSkills: skills.length === 0,
  ...(skills.length > 0 && {
    skillsOverride: () => ({ skills, diagnostics: [] }),
  }),
})
await resourceLoader.reload()

const { session } = await createAgentSession({
  model,
  tools: [],
  customTools: [weatherTool],
  sessionManager: SessionManager.inMemory(),
  resourceLoader,
})

session.subscribe((event) => {
  if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
    process.stdout.write(event.assistantMessageEvent.delta)
  }
  if (event.type === 'tool_execution_start') {
    console.log(`\n🔧 ${event.toolName}(${JSON.stringify(event.args)})`)
  }
  if (event.type === 'tool_execution_end') {
    console.log(`✅ Done\n`)
  }
})

const question = process.argv[2] || "What's the weather like in London today?"
console.log(`You: ${question}\n`)
process.stdout.write('Agent: ')

await session.prompt(question)

console.log()
process.exit(0)
