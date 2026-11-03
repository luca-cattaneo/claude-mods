import { expect, test } from 'claude-code/testing'

const BAR = { plugin: 'model-switch', component: 'PromptHint', props: { isDraft: false, isWorking: false, hint: '? for shortcuts' } } as const

for (const auto of ['off', 'on'] as const) {
  test(`bar draws with auto ${auto}`, async ($, on) => {
    on('ui.render', ($, e) => { const { Text } = $.ui.resolve(e); return <Text>hint</Text> })
    on('state.get', (_, e) => ({ value: { value: e.key === 'auto' ? auto : e.key === 'model' ? 'opus' : e.key === 'effort' ? 'high' : e.key.startsWith('pick') ? '' : 'off', version: 1 } }))
    const ui = await $.ui.mount({ ...BAR, surface: 'terminal' })
    expect((await ui.find({ type: 'Text', text: /auto/ }))?.text).toContain('auto')
    expect(!!(await ui.find({ type: 'Text', text: /\[opus\]/ }))).toBe(auto === 'off') // auto: no model selected
    await ui.unmount()
  })
}

for (const pick of ['', 'haiku'] as const) {
  test(`turn.step model with session pick '${pick}'`, async ($, on) => {
    let sent = ''
    on('state.get', (_, e) => ({ value: { value: e.key === 'pickModel' ? pick : e.key === 'pickEffort' ? (pick && 'low') : '?', version: 1 } }))
    on('state.set', () => ({ value: { isSet: true, version: 2 } }))
    on('turn.step', async function* (_, e) {
      sent = `${e.model}/${e.effort}`
      return { turnId: e.turnId, index: e.index, answer: '', toolUses: [] } as never
    })
    const s = $.turn.step({ turnId: 't', index: 0, model: 'opus', effort: 'high', messageCount: 1 } as never)
    for await (const _ of s) { /* drain */ }
    expect(sent).toBe(pick ? 'haiku/low' : 'opus/high') // no pick: the default goes out untouched
  })
}
