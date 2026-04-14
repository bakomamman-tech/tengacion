# Akuso Upgrade Notes

The current Akuso work is now centered on the dedicated backend-first engine under `/api/akuso`.

See the primary architecture document:

- [Akuso Backend Engine](./akuso-backend-engine.md)

Key shift:

- legacy assistant logic still exists for compatibility
- new Akuso foundation now lives in dedicated backend controller, services, middleware, tests, and evals
- OpenAI wiring is backend-only and model selection is server-side
- app-aware guidance is grounded in the real Tengacion feature registry
- policy, auth, rate limiting, and prompt-injection handling happen before model use

Verified with:

- `npm test --prefix backend -- --runTestsByPath tests/akusoRoutes.test.js tests/akusoServices.test.js tests/akusoRateLimit.test.js`
- `npm run eval:akuso --prefix backend`
