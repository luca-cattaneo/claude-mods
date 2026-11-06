declare module 'claude-code' {
  interface PluginState {
    'agent-statusline': { agents: Record<string, AgentRow> }
  }
}
// One loop's status-row figures ('main' = the main loop): the model that answered, its last request's input tokens.
export type AgentRow = { model: string; tokens?: number }
