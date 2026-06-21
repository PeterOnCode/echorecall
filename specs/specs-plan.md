# Specification Plan

1. change html for nuxt ui components

- 

2. Settings Tab

- Audio ID default values settings on settings tab not in .env file

- Recording date prefilled with tomorrow day


  - A CLI adapter — the plan deliberately put OpenAI-key resolution in src/core "so a future CLI honors the same precedence." A CLI
  over the framework-agnostic core is the most natural next adapter.
  - Verify gpt-4o-mini-tts honors speed — specs-plan.md flags this as an unverified implementation note.
  - Wire the optional live-OpenAI adapter test — vitest.adapters.config.ts mentions it as a "later" addition.
  - Auth — the README explicitly notes there's no built-in authentication; only relevant if this ever goes multi-user.

