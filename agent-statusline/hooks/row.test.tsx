import { expect, test } from 'claude-code/testing'

for (const agentId of [undefined, 'a1'] as const) {
  test(`status row follows the view (${agentId ?? 'main'})`, async ($, on) => {
    on('ui.render', ($, e) => { const { Text } = $.ui.resolve(e); return <Text>hint</Text> }) // the engine's hint line
    on('state.get', (_, e) => ({ value: { value: e.key === 'agents' ? { main: { model: 'claude-opus-5-5' }, a1: { model: 'claude-haiku-5-5', tokens: 50000 } } : '?', version: 1 } }))
    on('session.usage', () => ({ value: { startedAt: Date.now(), context: { tokens: 120000, window: 1000000, percent: 12 }, rateLimits: [] } }))
    on('session.cwd', () => ({ value: '/x/proj' }))
    on('process.run', () => ({ value: { exitCode: 128, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
    const above = { hasSurvey: false, isWorking: false, maxRows: 5, bodyColumns: 120, scroll: { offset: 0, bodyRows: 4 }, view: agentId ? { agentId } : {} }
    const sniff = await $.ui.mount({ plugin: 'agent-statusline', component: 'AbovePrompt', props: above, surface: 'terminal' })
    const ui = await $.ui.mount({ plugin: 'agent-statusline', component: 'PromptHint', props: { isDraft: false, isWorking: false, hint: '' }, surface: 'terminal' })
    const text = (await ui.find({ type: 'Text', text: /proj/ }))?.text
    expect(text).toContain(agentId ? '[Haiku 5.5]' : '[Opus 5.5]')
    expect(text).toContain(agentId ? '50k/200k' : '120k/1.0M')
    await ui.unmount()
    await sniff.unmount()
  })
}
