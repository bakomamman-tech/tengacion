# TengaAgent Pilot Preview Deployment

Use a separate preview service while finishing pilot validation. The production `tengacion` Render service tracks `main` and should remain untouched until explicit production approval.

The pilot preview needs a full backend runtime, not only the static/frontend preview, because readiness, billing, WhatsApp, voice notes, calendars, handoff and tenant storage are backend-dependent.

Before the full pilot preview can boot, add the required Render environment variables listed in `RENDER_ENVIRONMENT.md` to the preview service. Do not copy secrets into source control.
