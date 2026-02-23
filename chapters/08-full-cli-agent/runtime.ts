import * as path from 'node:path'
import type { Model, Api } from '@mariozechner/pi-ai'
import {
  createAgentSession,
  SessionManager,
  DefaultResourceLoader,
  loadSkillsFromDir,
  type AgentSession,
  type SessionInfo,
  type ToolDefinition,
} from '@mariozechner/pi-coding-agent'

// --- DeltaBatcher ---

class DeltaBatcher {
  private pendingText = ''
  private flushTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly onFlush: (text: string) => void,
    private readonly intervalMs = 32
  ) {}

  push(delta: string): void {
    this.pendingText += delta
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null
        const text = this.pendingText
        this.pendingText = ''
        if (text) this.onFlush(text)
      }, this.intervalMs)
    }
  }

  flush(): void {
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null }
    const text = this.pendingText
    this.pendingText = ''
    if (text) this.onFlush(text)
  }
}

// --- Confirmation Waiter ---

function createConfirmationWaiter() {
  let pendingResolve: ((v: { confirmed: boolean }) => void) | null = null

  const waiter = (): Promise<{ confirmed: boolean }> =>
    new Promise((resolve) => {
      pendingResolve = resolve
    })

  const stdinListener = (data: Buffer) => {
    if (pendingResolve) {
      const input = data.toString().trim().toLowerCase()
      const confirmed = input === 'y' || input === 'yes'
      pendingResolve({ confirmed })
      pendingResolve = null
    }
  }
  process.stdin.on('data', stdinListener)

  return {
    waiter,
    confirm: () => { if (pendingResolve) { pendingResolve({ confirmed: true }); pendingResolve = null } },
    cancel: () => { if (pendingResolve) { pendingResolve({ confirmed: false }); pendingResolve = null } },
    cleanup: () => process.stdin.off('data', stdinListener),
  }
}

// --- RuntimeConfig ---

export interface RuntimeConfig {
  model: Model<Api>
  cwd: string
  sessionDir: string
  skillsDir?: string
  systemPrompt: string
  customTools?: ToolDefinition[]
  includeCodingTools?: boolean
}

// --- AgentRuntime ---

export class AgentRuntime {
  private session!: AgentSession
  private sessionManager!: SessionManager
  private batcher = new DeltaBatcher((text) => process.stdout.write(text))
  private confirmation: ReturnType<typeof createConfirmationWaiter>
  private isPrompting = false

  constructor(private readonly config: RuntimeConfig) {
    this.confirmation = createConfirmationWaiter()
    this.initSession(SessionManager.create(config.cwd, config.sessionDir))
  }

  private async createResourceLoader() {
    let skillsConfig = {}
    if (this.config.skillsDir) {
      const { skills } = loadSkillsFromDir({ dir: this.config.skillsDir, source: 'cli-agent' })
      if (skills.length > 0) {
        skillsConfig = {
          noSkills: false,
          skillsOverride: () => ({ skills, diagnostics: [] }),
        }
        console.log(`📚 Loaded ${skills.length} skill(s)`)
      }
    }

    const rl = new DefaultResourceLoader({
      systemPromptOverride: () => this.config.systemPrompt,
      noExtensions: true,
      noPromptTemplates: true,
      noThemes: true,
      noSkills: true,
      ...skillsConfig,
    })
    await rl.reload()
    return rl
  }

  private async initSession(sm: SessionManager) {
    this.sessionManager = sm
    const resourceLoader = await this.createResourceLoader()
    const tools = this.config.includeCodingTools ? ['read', 'write', 'edit', 'bash'] : []
    const { session } = await createAgentSession({
      model: this.config.model,
      tools: tools as any,
      customTools: this.config.customTools ?? [],
      sessionManager: sm,
      resourceLoader,
    })
    this.session = session

    session.subscribe((event) => {
      if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
        this.batcher.push(event.assistantMessageEvent.delta)
      }
      if (event.type === 'tool_execution_start') {
        this.batcher.flush()
        console.log(`\n🔧 ${event.toolName}(${JSON.stringify(event.args)})`)
      }
      if (event.type === 'tool_execution_end') {
        console.log(`✅ Done\n`)
      }
    })
  }

  createConfirmationWaiter() { return this.confirmation.waiter }
  confirmTool() { this.confirmation.confirm() }
  cancelTool() { this.confirmation.cancel() }

  async prompt(text: string) {
    if (!text || this.isPrompting) return
    this.isPrompting = true
    process.stdout.write('\nAgent: ')
    try {
      await this.session.prompt(text)
    } catch (error) {
      if (String(error).includes('abort')) {
        // Aborted by user
      } else {
        console.error('\nError:', error instanceof Error ? error.message : String(error))
      }
    }
    this.batcher.flush()
    console.log('\n')
    this.isPrompting = false
  }

  abort() {
    if (this.isPrompting) {
      this.session.abort()
      this.batcher.flush()
    }
  }

  async newSession() {
    this.session.dispose()
    await this.initSession(SessionManager.create(this.config.cwd, this.config.sessionDir))
    console.log('📝 New session created\n')
  }

  async openSession(sessionPath: string) {
    this.session.dispose()
    await this.initSession(SessionManager.open(sessionPath, this.config.sessionDir))
    console.log('📂 Session opened\n')
  }

  async continueRecentSession() {
    this.session.dispose()
    try {
      await this.initSession(SessionManager.continueRecent(this.config.cwd, this.config.sessionDir))
      console.log('📂 Resumed most recent session\n')
    } catch {
      await this.initSession(SessionManager.create(this.config.cwd, this.config.sessionDir))
      console.log('📝 No previous session found. Created new session.\n')
    }
  }

  async listSessions(): Promise<SessionInfo[]> {
    return SessionManager.list(this.config.cwd, this.config.sessionDir)
  }

  destroy() {
    this.session.dispose()
    this.confirmation.cleanup()
    this.batcher.flush()
  }
}
