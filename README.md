# claude-mods

Personal Claude Code mods.

## model-switch

A one-row bar under the prompt to switch model, effort and advisor model in one press.

```
🧠 [auto] fable opus sonnet haiku | low [medium] high xhigh max | advisor [off] fable opus sonnet
```

Load it in every session by adding to `~/.claude/settings.json`:

```json
"env": { "CLAUDE_CODE_PLUGIN_DIRS": "~/claude-mods/model-switch" }
```

## agent-statusline

A status row (model, context, project/git, 5h/7d, duration; a copy of `~/.claude/statusline.mjs`) under the model-switch bar.
Its model and context follow the open subagent.
