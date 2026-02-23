import { Type } from '@sinclair/typebox'
import type { ToolDefinition } from '@mariozechner/pi-coding-agent'

export const weatherTool: ToolDefinition = {
  name: 'get_weather',
  label: 'Get Weather',
  description: 'Get current weather for a city. Use this when the user asks about weather.',
  parameters: Type.Object({
    city: Type.String({ description: 'City name (e.g. "Tokyo", "London")' }),
  }),
  execute: async (_toolCallId, params) => {
    const { city } = params as { city: string }

    const weatherData: Record<string, { temp: string; condition: string; humidity: string }> = {
      tokyo: { temp: '22°C', condition: 'Sunny', humidity: '45%' },
      london: { temp: '14°C', condition: 'Cloudy', humidity: '78%' },
      'new york': { temp: '18°C', condition: 'Partly cloudy', humidity: '55%' },
    }

    const key = city.toLowerCase()
    const weather = weatherData[key] || { temp: '20°C', condition: 'Clear', humidity: '50%' }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ city, ...weather }),
      }],
      details: {},
    }
  },
}

export const calculatorTool: ToolDefinition = {
  name: 'calculate',
  label: 'Calculator',
  description: 'Evaluate a mathematical expression. Use for any math calculations.',
  parameters: Type.Object({
    expression: Type.String({ description: 'Math expression to evaluate (e.g. "2 + 3 * 4")' }),
  }),
  execute: async (_toolCallId, params) => {
    const { expression } = params as { expression: string }
    try {
      const result = Function(`"use strict"; return (${expression})`)()
      return {
        content: [{ type: 'text' as const, text: String(result) }],
        details: {},
      }
    } catch (e) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
        details: {},
      }
    }
  },
}
