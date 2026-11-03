import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const model = atom({ plugin: 'model-switch', key: 'model' } as const, '?')
const effort = atom({ plugin: 'model-switch', key: 'effort' } as const, '?')
const advisor = atom({ plugin: 'model-switch', key: 'advisor' } as const, 'off')
const auto = atom({ plugin: 'model-switch', key: 'auto' } as const, 'off')

const MODELS = ['fable', 'opus', 'sonnet', 'haiku'] // most → least powerful
const ADVISORS = ['off', 'fable', 'opus', 'sonnet'] // /advisor validates; haiku as advisor makes no sense
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max']
const EFFORT_COLOR: Record<string, string> = { low: '#22c55e', medium: '#a3e635', high: '#facc15', xhigh: '#f97316', max: '#ef4444' }
const EFFORT_DIM: Record<string, string> = { low: '#2f6b45', medium: '#5e7a35', high: '#857232', xhigh: '#8a5530', max: '#8a3b3b' }

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const m = await $.session.model()
    const lvl = await $.settings.read({ key: 'effortLevel' })
    await update($, model, () => m)
    await update($, effort, () => String(lvl ?? '?'))
    const adv = await $.settings.read({ key: 'advisorModel' })
    await update($, advisor, () => String(adv ?? 'off'))
    // close the docked pane an earlier version opened
    await $.ui.close({ id: 'model-switch' }).catch(() => undefined)
    return next(e)
  })

  // Truth source: what the engine actually sends on each main-loop request.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) {
      await update($, model, () => e.model)
      await update($, effort, () => (e.effort === undefined ? 'n/a' : String(e.effort)))
    }
    return yield* next(e)
  })

  // Catch /model and /effort typed by hand, not only the bar's buttons.
  on('command.run', { command: 'model' }, async ($, e, next) => {
    const r = await next(e)
    const m = await $.session.model()
    await update($, model, () => m)
    const a = e.args.trim()
    if (a) await update($, auto, () => (a === 'default' ? 'on' : 'off'))
    return r
  }).catch(($, e, next) => (next.called ? { text: '' } : next(e)))
  on('command.run', { command: 'effort' }, async ($, e, next) => {
    const r = await next(e)
    const lvl = e.args.trim()
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
    const m = await read($, model)
    const lvl = await read($, effort)
    const adv = await read($, advisor)
    const isAuto = (await read($, auto)) === 'on' // auto: model + effort groups go gray
    const advOff = adv === 'off' // advisor off: the whole group goes gray

    const setAuto = () => {
      void update($, auto, () => 'on')
      void $.command.run({ command: 'model', args: 'default' })
      void $.command.run({ command: 'effort', args: 'auto' })
    }
    const setModel = (name: string) => {
      void update($, auto, () => 'off')
      void update($, model, () => name)
      void $.command.run({ command: 'model', args: name })
    }
    const setAdvisor = (name: string) => {
      void update($, advisor, () => name)
      void $.command.run({ command: 'advisor', args: name })
    }
    const setEffort = (name: string) => {
      void update($, auto, () => 'off')
      void update($, effort, () => name)
      void $.command.run({ command: 'effort', args: name })
    }

    return (
      <Box flexDirection="column">
        {hint}
        <Box>
          <Text>🧠 </Text>
          {isAuto
            ? <Text bold color="#4d94f0"> [auto] </Text>
            : <Button key="m-auto" plain onPress={setAuto}><Text color="#3f68a8"> auto </Text></Button>}
          {MODELS.map(n =>
            !isAuto && m.includes(n) // auto: nothing selected, all gray
              ? <Text key={`m-${n}`} bold color="#4d94f0"> [{n}] </Text>
              : <Button key={`m-${n}`} plain onPress={() => setModel(n)}><Text color={isAuto ? 'gray' : '#3f68a8'} dimColor={isAuto}> {n} </Text></Button>,
          )}
          <Text dimColor> | </Text>
          {EFFORTS.map(n =>
            !isAuto && lvl === n
              ? <Text key={`e-${n}`} bold color={EFFORT_COLOR[n]}> [{n}] </Text>
              : <Button key={`e-${n}`} plain onPress={() => setEffort(n)}><Text color={isAuto ? 'gray' : EFFORT_DIM[n]} dimColor={isAuto}> {n} </Text></Button>,
          )}
          <Text dimColor> | advisor </Text>
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
