import { expect, test } from 'claude-code/testing'

const BAR = { plugin: 'model-switch', component: 'PromptHint', props: { isDraft: false, isWorking: false, hint: '? for shortcuts' } } as const

for (const auto of ['off', 'on'] as const) {
  test(`bar draws with auto ${auto}`, async ($, on) => {
    on('ui.render', ($, e) => { const { Text } = $.ui.resolve(e); return <Text>hint</Text> })
    on('state.get', (_, e) => ({ value: { value: e.key === 'auto' ? auto : e.key === 'model' ? 'opus' : e.key === 'effort' ? 'high' : 'off', version: 1 } }))
    const ui = await $.ui.mount({ ...BAR, surface: 'terminal' })
    expect((await ui.find({ type: 'Text', text: /auto/ }))?.text).toContain('auto')
    expect(!!(await ui.find({ type: 'Text', text: /\[opus\]/ }))).toBe(auto === 'off') // auto: no model selected
    await ui.unmount()
  })
}
