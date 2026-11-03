import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const model = atom({ plugin: 'model-switch', key: 'model' } as const, '?')
const effort = atom({ plugin: 'model-switch', key: 'effort' } as const, '?')
const advisor = atom({ plugin: 'model-switch', key: 'advisor' } as const, 'off')
const auto = atom({ plugin: 'model-switch', key: 'auto' } as const, 'off')
// Session-only picks from the bar: '' = none (the default set by /model, /effort applies), 'auto' = auto for this session.
const pickModel = atom({ plugin: 'model-switch', key: 'pickModel' } as const, '')
const pickEffort = atom({ plugin: 'model-switch', key: 'pickEffort' } as const, '')
// code simplification: the account default model is learned at session start only when no /model is saved; else the 'opus' alias
const defaultModel = atom({ plugin: 'model-switch', key: 'defaultModel' } as const, 'opus')

const MODELS = ['fable', 'opus', 'sonnet', 'haiku'] // most → least powerful
const ADVISORS = ['off', 'fable', 'opus', 'sonnet'] // /advisor validates; haiku as advisor makes no sense
const EFFORTS_T = ['low', 'medium', 'high', 'xhigh', 'max'] as const
const EFFORTS: readonly string[] = EFFORTS_T
const EFFORT_COLOR: Record<string, string> = { low: '#22c55e', medium: '#a3e635', high: '#facc15', xhigh: '#f97316', max: '#ef4444' }
const EFFORT_DIM: Record<string, string> = { low: '#2f6b45', medium: '#5e7a35', high: '#857232', xhigh: '#8a5530', max: '#8a3b3b' }

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const m = await $.session.model()
    const lvl = await $.settings.read({ key: 'effortLevel' })
    await update($, model, () => m)
    await update($, effort, () => String(lvl ?? '?'))
    if ((await $.settings.read({ key: 'model' })) === undefined) await update($, defaultModel, () => m)
    const adv = await $.settings.read({ key: 'advisorModel' })
    await update($, advisor, () => String(adv ?? 'off'))
    // close the docked pane an earlier version opened
    await $.ui.close({ id: 'model-switch' }).catch(() => undefined)
    return next(e)
  })

  // Defaults come from what the engine resolves; the bar's session picks then rewrite the main-loop request.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined) return yield* next(e)
    await update($, model, () => e.model)
    await update($, effort, () => (e.effort === undefined ? 'n/a' : String(e.effort)))
    const pm = await read($, pickModel)
    const pe = await read($, pickEffort)
    const mdl = pm === 'auto' ? await read($, defaultModel) : pm || e.model
    if (pe !== 'auto') return yield* next({ ...e, model: mdl, ...(pe && { effort: pe as (typeof EFFORTS_T)[number] }) })
    // auto effort = what the engine does for /effort auto: the model's modelSettings level, else no effort (the model's own default)
    const perModel = (await $.settings.read({ key: 'modelSettings' })) as Record<string, { effortLevel?: string }> | undefined
    const lvl = perModel?.[mdl]?.effortLevel as (typeof EFFORTS_T)[number] | undefined // a model may have no entry
    const { effort: _, ...rest } = e
    return yield* next({ ...rest, model: mdl, ...(lvl && { effort: lvl }) })
  })

  // /model and /effort typed by hand set the default and drop the session pick (buttons no longer run them).
  on('command.run', { command: 'model' }, async ($, e, next) => {
    const r = await next(e)
    await update($, pickModel, () => '')
    const m = await $.session.model()
    await update($, model, () => m)
    const a = e.args.trim()
    if (a) await update($, auto, () => (a === 'default' ? 'on' : 'off'))
    return r
  }).catch(($, e, next) => (next.called ? { text: '' } : next(e)))
  on('command.run', { command: 'effort' }, async ($, e, next) => {
    const r = await next(e)
    const lvl = e.args.trim()
    if (lvl) await update($, pickEffort, () => '')
    if (EFFORTS.includes(lvl)) {
      await update($, effort, () => lvl)
      await update($, auto, () => 'off')
    }
    return r
  })

  on('command.run', { command: 'advisor' }, async ($, e, next) => {
    const r = await next(e)
    const a = e.args.trim()
    if (a) await update($, advisor, () => a)
    return r
  })

  // Footer slot under the input: the selector bar. The engine draws its hint line above.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const hint = await next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    const pm = await read($, pickModel)
    const pe = await read($, pickEffort)
    const m = pm || (await read($, model))
    const lvl = pe || (await read($, effort))
    const adv = await read($, advisor)
    const autoDefault = (await read($, auto)) === 'on'
    const mAuto = pm === 'auto' || (autoDefault && !pm) // a group goes gray while it is on auto
    const eAuto = pe === 'auto' || (autoDefault && !pe)
    const isAuto = mAuto && eAuto
    const advOff = adv === 'off' // advisor off: the whole group goes gray

    const setAuto = () => {
      void update($, pickModel, () => 'auto')
      void update($, pickEffort, () => 'auto')
    }
    const setModel = (name: string) => void update($, pickModel, () => name)
    const setAdvisor = (name: string) => {
      void update($, advisor, () => name)
      void $.command.run({ command: 'advisor', args: name })
    }
    const setEffort = (name: string) => void update($, pickEffort, () => name)

    return (
      <Box flexDirection="column">
        {hint}
        <Box>
          <Text>🧠 </Text>
          {isAuto
            ? <Text bold color="#4d94f0"> [auto] </Text>
            : <Button key="m-auto" plain onPress={setAuto}><Text color="#3f68a8"> auto </Text></Button>}
          {MODELS.map(n =>
            !mAuto && m.includes(n) // auto: nothing selected, all gray
              ? <Text key={`m-${n}`} bold color="#4d94f0"> [{n}] </Text>
              : <Button key={`m-${n}`} plain onPress={() => setModel(n)}><Text color={mAuto ? 'gray' : '#3f68a8'} dimColor={mAuto}> {n} </Text></Button>,
          )}
          <Text dimColor> | </Text>
          {/* color emoji ignore ANSI color → swap to a monochrome glyph when the group is grayed */}
          {eAuto ? <Text color="gray" dimColor>↯ </Text> : <Text>⚡ </Text>}
          {EFFORTS.map(n =>
            !eAuto && lvl === n
              ? <Text key={`e-${n}`} bold color={EFFORT_COLOR[n]}> [{n}] </Text>
              : <Button key={`e-${n}`} plain onPress={() => setEffort(n)}><Text color={eAuto ? 'gray' : EFFORT_DIM[n]} dimColor={eAuto}> {n} </Text></Button>,
          )}
          <Text dimColor> | </Text>
          {advOff ? <Text color="gray" dimColor>◉ </Text> : <Text>👁️ </Text>}
          {ADVISORS.map(n =>
            adv.includes(n)
              ? <Text key={`a-${n}`} bold color={advOff ? 'gray' : '#b76de0'}> [{n}] </Text>
              : <Button key={`a-${n}`} plain onPress={() => setAdvisor(n)}><Text color={advOff ? 'gray' : '#74479a'} dimColor={advOff}> {n} </Text></Button>,
          )}
        </Box>
      </Box>
    )
  })
}
