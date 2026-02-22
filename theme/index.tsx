import React from 'react'
import { Layout as DefaultLayout } from '@rspress/core/theme-original'

// ─── Stats Bar ─────────────────────────────────────────────────

const stats = [
  { value: '8', label: 'Chapters', icon: '\u{1F4D6}' },
  { value: '15+', label: 'Source Files', icon: '\u{1F4C4}' },
  { value: '5', label: 'Core Patterns', icon: '\u{1F9E9}' },
  { value: '4', label: 'AI Providers', icon: '\u{1F916}' },
]

const StatsBar = () => (
  <section style={{ maxWidth: 1152, margin: '0 auto', padding: '64px 24px' }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
      {stats.map((s) => (
        <div
          key={s.label}
          style={{
            textAlign: 'center',
            padding: '32px 16px',
            borderRadius: 12,
            border: '1px solid var(--rp-c-divider-light)',
            background: 'var(--rp-c-bg)',
            transition: 'border-color 0.25s, box-shadow 0.25s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--rp-c-brand)'
            e.currentTarget.style.boxShadow = '0 2px 12px var(--rp-c-brand-tint)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--rp-c-divider-light)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>{s.icon}</div>
          <div
            style={{
              fontSize: 40,
              fontWeight: 700,
              lineHeight: 1.1,
              background: 'var(--rp-home-hero-title-bg)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {s.value}
          </div>
          <div style={{ marginTop: 8, fontSize: 14, color: 'var(--rp-c-text-2)', fontWeight: 500 }}>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  </section>
)

// ─── Framework Comparison ──────────────────────────────────────

const frameworks = [
  { name: 'pi-coding-agent', highlight: true },
  { name: 'Vercel AI SDK' },
  { name: 'LangChain' },
  { name: 'CrewAI' },
  { name: 'OpenAI Agents SDK' },
  { name: 'Mastra' },
]

type Support = true | false | 'partial'

const features: { name: string; values: Support[] }[] = [
  //                                         pi     vercel  lang   crew   openai  mastra
  { name: 'TypeScript-first',     values: [true,   true,   'partial', false, true,  true  ] },
  { name: 'Streaming Events',     values: [true,   true,   true,  false, true,  true  ] },
  { name: 'Tool / Function Call', values: [true,   true,   true,  true,  true,  true  ] },
  { name: 'Session Persistence',  values: [true,   false,  true,  false, false, false ] },
  { name: 'Multi-Provider',       values: [true,   true,   true,  true,  false, true  ] },
  { name: 'Built-in Coding Tools',values: [true,   false,  false, false, false, false ] },
  { name: 'Skill / Plugin System',values: [true,   false,  true,  true,  false, true  ] },
  { name: 'Human-in-the-Loop',    values: [true,   false,  true,  true,  true,  false ] },
  { name: 'Multi-Agent',          values: [false,  false,  true,  true,  true,  true  ] },
  { name: 'GUI / Studio',         values: [false,  false,  true,  true,  false, false ] },
]

const supportIcon = (v: Support) =>
  v === true ? '\u2705' : v === 'partial' ? '\u{1F7E1}' : '\u2014'

const FrameworkComparison = () => (
  <section style={{ maxWidth: 1152, margin: '0 auto', padding: '0 24px 64px' }}>
    <h2 style={{ textAlign: 'center', fontSize: 28, fontWeight: 700, marginBottom: 8, color: 'var(--rp-c-text-0)' }}>
      Framework Comparison
    </h2>
    <p style={{ textAlign: 'center', color: 'var(--rp-c-text-2)', marginBottom: 32, fontSize: 15 }}>
      How pi-coding-agent stacks up against other popular AI agent frameworks.
    </p>
    <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--rp-c-divider-light)', background: 'var(--rp-c-bg)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 760 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '14px 16px', borderBottom: '2px solid var(--rp-c-divider-light)', color: 'var(--rp-c-text-1)', fontWeight: 600, position: 'sticky' as const, left: 0, background: 'var(--rp-c-bg)', zIndex: 1 }}>
              Feature
            </th>
            {frameworks.map((fw) => (
              <th
                key={fw.name}
                style={{
                  textAlign: 'center',
                  padding: '14px 10px',
                  borderBottom: '2px solid var(--rp-c-divider-light)',
                  fontWeight: 600,
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                  color: fw.highlight ? 'var(--rp-c-brand)' : 'var(--rp-c-text-2)',
                  background: fw.highlight ? 'var(--rp-c-brand-tint)' : 'transparent',
                }}
              >
                {fw.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {features.map((feat, i) => (
            <tr key={feat.name} style={{ borderBottom: i < features.length - 1 ? '1px solid var(--rp-c-divider-light)' : 'none' }}>
              <td style={{ padding: '11px 16px', color: 'var(--rp-c-text-1)', fontWeight: 500, whiteSpace: 'nowrap', position: 'sticky' as const, left: 0, background: 'var(--rp-c-bg)', zIndex: 1 }}>
                {feat.name}
              </td>
              {feat.values.map((v, j) => (
                <td
                  key={j}
                  style={{
                    textAlign: 'center',
                    padding: '11px 10px',
                    fontSize: 15,
                    background: frameworks[j].highlight ? 'var(--rp-c-brand-tint)' : 'transparent',
                    color: v === true ? 'var(--rp-c-text-1)' : 'var(--rp-c-text-4)',
                  }}
                >
                  {supportIcon(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <p style={{ textAlign: 'center', color: 'var(--rp-c-text-3)', marginTop: 12, fontSize: 12 }}>
      {'\u2705'} Supported &nbsp;&nbsp; {'\u{1F7E1}'} Partial &nbsp;&nbsp; {'\u2014'} Not built-in
    </p>
  </section>
)

// ─── Concept Matrix ────────────────────────────────────────────

const chapters = ['01', '02', '03', '04', '05', '06', '07', '08']

const concepts: { name: string; covered: boolean[] }[] = [
  { name: 'createAgentSession',   covered: [true,  true,  true,  true,  true,  true,  true,  true ] },
  { name: 'Streaming / Events',   covered: [false, true,  true,  false, false, true,  false, true ] },
  { name: 'Custom Tools',         covered: [false, false, true,  false, true,  true,  false, true ] },
  { name: 'Session Persistence',  covered: [false, false, false, true,  false, false, true,  true ] },
  { name: 'Confirmation Pattern', covered: [false, false, false, false, true,  false, false, true ] },
  { name: 'System Prompt',        covered: [false, false, false, false, false, true,  false, true ] },
  { name: 'Skills Loading',       covered: [false, false, false, false, false, true,  false, true ] },
  { name: 'Multi-Session',        covered: [false, false, false, false, false, false, true,  true ] },
  { name: 'Coding Tools',         covered: [false, false, false, false, false, false, false, true ] },
  { name: 'Abort / DeltaBatcher', covered: [false, false, false, false, false, false, false, true ] },
]

const ConceptMatrix = () => (
  <section style={{ maxWidth: 1152, margin: '0 auto', padding: '0 24px 64px' }}>
    <h2 style={{ textAlign: 'center', fontSize: 28, fontWeight: 700, marginBottom: 8, color: 'var(--rp-c-text-0)' }}>
      Concept Coverage
    </h2>
    <p style={{ textAlign: 'center', color: 'var(--rp-c-text-2)', marginBottom: 32, fontSize: 15 }}>
      Each chapter progressively introduces new patterns. Chapter 08 combines them all.
    </p>
    <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--rp-c-divider-light)', background: 'var(--rp-c-bg)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 600 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '14px 16px', borderBottom: '1px solid var(--rp-c-divider-light)', color: 'var(--rp-c-text-1)', fontWeight: 600, position: 'sticky' as const, left: 0, background: 'var(--rp-c-bg)' }}>
              Concept
            </th>
            {chapters.map((ch) => (
              <th key={ch} style={{ textAlign: 'center', padding: '14px 8px', borderBottom: '1px solid var(--rp-c-divider-light)', color: 'var(--rp-c-text-2)', fontWeight: 600, fontSize: 12 }}>
                Ch{ch}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {concepts.map((concept, i) => (
            <tr key={concept.name} style={{ borderBottom: i < concepts.length - 1 ? '1px solid var(--rp-c-divider-light)' : 'none' }}>
              <td style={{ padding: '10px 16px', color: 'var(--rp-c-text-1)', fontWeight: 500, whiteSpace: 'nowrap', position: 'sticky' as const, left: 0, background: 'var(--rp-c-bg)' }}>
                <code style={{ fontSize: 13, padding: '2px 6px', borderRadius: 4, background: 'var(--rp-c-bg-soft)' }}>
                  {concept.name}
                </code>
              </td>
              {concept.covered.map((on, j) => (
                <td key={j} style={{ textAlign: 'center', padding: '10px 8px' }}>
                  <div
                    style={{
                      width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 6, margin: '0 auto', fontSize: 14,
                      background: on ? 'var(--rp-c-brand-tint)' : 'transparent',
                      color: on ? 'var(--rp-c-brand)' : 'var(--rp-c-text-4)',
                      fontWeight: on ? 700 : 400,
                    }}
                  >
                    {on ? '\u25CF' : '\u00B7'}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
)

// ─── Tech Stack ────────────────────────────────────────────────

const techItems = [
  { name: 'pi-coding-agent', desc: 'Agent framework \u2014 sessions, tools, resources, streaming', tag: 'Core', color: '#ff5e00' },
  { name: 'pi-ai', desc: 'Model abstraction \u2014 Anthropic, OpenAI, Google, DeepSeek', tag: 'AI', color: '#ff7524' },
  { name: 'TypeBox', desc: 'JSON Schema builder for tool parameter definitions', tag: 'Schema', color: '#ffb224' },
  { name: 'TypeScript', desc: 'Strict mode, ESM, top-level await', tag: 'Language', color: '#3b82f6' },
  { name: 'Bun + tsx', desc: 'Fast runtime and TypeScript execution', tag: 'Runtime', color: '#10b981' },
  { name: 'JSONL Sessions', desc: 'Line-delimited JSON for persistent conversation storage', tag: 'Storage', color: '#8b5cf6' },
]

const TechStack = () => (
  <section style={{ maxWidth: 1152, margin: '0 auto', padding: '0 24px 80px' }}>
    <h2 style={{ textAlign: 'center', fontSize: 28, fontWeight: 700, marginBottom: 8, color: 'var(--rp-c-text-0)' }}>
      Tech Stack
    </h2>
    <p style={{ textAlign: 'center', color: 'var(--rp-c-text-2)', marginBottom: 32, fontSize: 15 }}>
      The tools and libraries used throughout this tutorial.
    </p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      {techItems.map((item) => (
        <div
          key={item.name}
          style={{
            padding: 20, borderRadius: 12,
            border: '1px solid var(--rp-c-divider-light)',
            background: 'var(--rp-c-bg)',
            transition: 'border-color 0.25s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = item.color }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--rp-c-divider-light)' }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: `${item.color}18`, color: item.color }}>
            {item.tag}
          </span>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--rp-c-text-0)', marginTop: 10, marginBottom: 4 }}>
            {item.name}
          </div>
          <div style={{ fontSize: 13, color: 'var(--rp-c-text-2)', lineHeight: 1.5 }}>
            {item.desc}
          </div>
        </div>
      ))}
    </div>
  </section>
)

// ─── Custom Layout ─────────────────────────────────────────────

export const Layout = () => (
  <DefaultLayout
    afterFeatures={
      <>
        <StatsBar />
        <FrameworkComparison />
        <ConceptMatrix />
        <TechStack />
      </>
    }
  />
)

export * from '@rspress/core/theme-original'
