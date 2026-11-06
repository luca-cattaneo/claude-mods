# claude-mods

Personal Claude Code mods, one folder each.

| Mod | What it draws |
|---|---|
| [`model-switch`](#model-switch) | Bar under the prompt: switch model, effort and advisor in one press |
| [`agent-statusline`](#agent-statusline) | Status row under that bar, following the open subagent |

```
❯ _
🧠 [auto] fable opus sonnet haiku | ⚡ low [medium] high xhigh max | 👁️ [off] fable opus sonnet
[Opus 5.5] ██░░░░░░░░ 120k/1.0M | claude-mods git:(main ↑1) | ███░░░░░░░ 34% (2h 10m / 5h) | ⏱️  42m
```

## Install

List the mod folders in `~/.claude/settings.json` (`:`-separated), then restart Claude Code:

```json
"env": { "CLAUDE_CODE_PLUGIN_DIRS": "~/claude-mods/agent-statusline:~/claude-mods/model-switch" }
```

Keep `agent-statusline` first: that order puts its row under the switch. Each mod also works alone. Edits to a listed folder hot-reload.

## model-switch

Picks from the bar last for the session only. `/model` and `/effort` set the default. `auto` uses the default model with per-model effort.

## agent-statusline

A copy of the old `~/.claude/statusline.mjs`: model, context bar, project/git, 5h/7d quotas and session duration, in the same colors. Open a subagent and its model and context take over the row. Use it in place of the `statusLine` setting.

Limits: a subagent's window is guessed (200k, or 1M for `[1m]` models), and its context shows `--` until its first reply.
