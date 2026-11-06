import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const agents = atom({ plugin: 'agent-statusline', key: 'agents' } as const, {})

// code simplification: PromptHint has no view, so the open agent is sniffed from AbovePrompt; drop it when PromptHint gets `view`.
let viewAgentId: string | undefined

// ── status row: a copy of ~/.claude/statusline.mjs (same thresholds and colors) ──
// ansi256(0-15) = the terminal's own palette, as statusline.mjs's \x1b[3Xm codes; bare names ("cyan") don't render as ANSI and "ansi:" is refused
const ctxColor = (p: number) => (p >= 85 ? 'ansi256(1)' : p >= 70 ? 'ansi256(3)' : 'ansi256(2)')
const quotaColor = (p: number) => (p >= 90 ? 'ansi256(1)' : p >= 75 ? 'ansi256(13)' : 'ansi256(12)')
const clamp = (p: number) => Math.round(Math.min(100, Math.max(0, p)))
const fmtTokens = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`)
const prettyModel = (m: string) => m.replace(/^claude-/, '').replace(/-(\d+)-(\d+)/, ' $1.$2').replace(/^\w/, c => c.toUpperCase())
// code simplification: the API gives no subagent window; 1M for a [1m] id, else 200k. Add a model → window entry if one reads off.
const windowOf = (m: string) => (m.includes('[1m]') ? 1_000_000 : 200_000)
const WINDOWS: Record<string, string> = { five_hour: '5h', seven_day: '7d' }
const fmtReset = (iso: string | undefined) => {
  if (!iso) return ''
  const diff = Date.parse(iso) - Date.now()
  if (diff <= 0) return ''
  const m = Math.ceil(diff / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60), rm = m % 60
  if (h >= 24) { const d = Math.floor(h / 24), rh = h % 24; return rh > 0 ? `${d}d ${rh}h` : `${d}d` }
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`
}
const fmtDuration = (ms: number) => {
  const mins = Math.floor(ms / 60000)
  return mins < 1 ? '<1m' : mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`
}
// code simplification: two git runs per band redraw (as the statusline does per refresh); cache on turn.complete if it lags.
const gitSegment = async ($: EngineInterface, cwd: string) => {
  const run = (argv: string[]) => $.process.run(argv, { cwd, timeoutMs: 1000 })
  const b = await run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'])
  if (b.exitCode !== 0) return ''
  const c = await run(['git', 'rev-list', '--left-right', '--count', '@{upstream}...HEAD'])
  const [behind = 0, ahead = 0] = c.exitCode === 0 ? c.stdout.trim().split(/\s+/).map(Number) : []
  return `${b.stdout.trim()}${ahead > 0 ? ` ↑${ahead}` : ''}${behind > 0 ? ` ↓${behind}` : ''}`
}

export const register: Register = on => {
  // Pass-through: the ledger keeps each loop's ('main' = the main loop) answering model and its last request's context fill.
  on('turn.step', async function* ($, e, next) {
    const id = e.agentId ?? 'main'
    if (!(await read($, agents))[id]) await update($, agents, a => ({ ...a, [id]: { model: e.model } }))
    const r = yield* next(e)
    const u = r.usage
    if (u) await update($, agents, a => ({ ...a, [id]: { model: u.model, tokens: u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens } }))
    return r
  })

  // Draws nothing: only learns which transcript is in view (state writes are denied while drawing, hence a module variable).
  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    const id = e.props.view.agentId
    if (id !== viewAgentId) {
      viewAgentId = id
      $.ui.invalidate('ui.render') // the guard above stops the redraw from looping
    }
    return next(e)
  })

  // Row under the switch (this plugin loads first, so its next(e) holds the switch): model + context follow the view.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const above = await next(e)
    const { Box, Text } = $.ui.resolve(e)
    const id = viewAgentId
    const [usage, ledger, cwd] = await Promise.all([$.session.usage(), read($, agents), $.session.cwd()])
    const row = ledger[id ?? 'main']
    const model = row?.model ?? (id ? undefined : await $.session.model())
    const tokens = id ? row?.tokens : (usage.context.tokens ?? 0)
    const size = id ? (model ? windowOf(model) : 0) : usage.context.window
    const p = id ? (tokens !== undefined && size ? clamp((tokens / size) * 100) : 0) : clamp(usage.context.percent ?? 0)
    const git = await gitSegment($, cwd).catch(() => '') // a timeout rejects
    const cols = e.viewport?.columns ?? 80 // absent where no surface measured: the middle width
    const w = cols >= 100 ? 10 : cols >= 60 ? 6 : 4
    const bar = (k: string, pct: number, color: string) => {
      const f = Math.round((pct / 100) * w)
      return [<Text key={`${k}f`} color={color}>{'█'.repeat(f)}</Text>, <Text key={`${k}e`} dimColor>{'░'.repeat(w - f)}</Text>]
    }
    const sep = (k: string) => <Text key={k}> | </Text>
    const wins = usage.rateLimits.filter(r => r.kind in WINDOWS)
    const full = wins.find(r => r.percentUsed >= 100)
    const project = cwd.split('/').filter(Boolean).pop() ?? '/'

    return (
      <Box flexDirection="column">
        {above}
        <Text wrap="truncate-end">
          {model ? <Text color="ansi256(6)">[{prettyModel(model)}]</Text> : <Text dimColor>[--]</Text>}
          <Text> </Text>
          {tokens === undefined
            ? <Text dimColor>--</Text>
            : [...bar('ctx', p, ctxColor(p)), <Text key="ctxt" color={ctxColor(p)}> {fmtTokens(tokens)}{size ? `/${fmtTokens(size)}` : ''}</Text>]}
          {sep('s1')}
          <Text color="ansi256(3)">{project}</Text>
          {git && [<Text key="g1" color="ansi256(5)"> git:(</Text>, <Text key="g2" color="ansi256(6)">{git}</Text>, <Text key="g3" color="ansi256(5)">)</Text>]}
          {full
            ? [sep('s2'), <Text key="lim" color="ansi256(1)">⚠ Limit reached{fmtReset(full.resetsAt) && ` (resets ${fmtReset(full.resetsAt)})`}</Text>]
            : wins.flatMap(r => {
                const q = clamp(r.percentUsed), reset = fmtReset(r.resetsAt)
                return [sep(`s-${r.kind}`), ...bar(r.kind, q, quotaColor(q)), <Text key={`${r.kind}t`} color={quotaColor(q)}> {q}%</Text>, <Text key={`${r.kind}r`}>{reset && ` (${reset} / ${WINDOWS[r.kind]})`}</Text>]
              })}
          {sep('s3')}
          <Text dimColor>⏱️  {fmtDuration(Date.now() - usage.startedAt)}</Text>
        </Text>
      </Box>
    )
  })
}
