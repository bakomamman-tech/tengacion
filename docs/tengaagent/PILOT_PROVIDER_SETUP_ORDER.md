# TengaAgent Pilot Provider Setup Order

For a real WhatsApp pilot, configure in this order:

1. Full-stack preview/pilot Render service is running.
2. Render environment variables are added.
3. Meta webhook callback is set to the pilot backend route.
4. Meta verify token matches Render.
5. Webhook subscription verifies successfully.
6. Tenant `phone_number_id` mapping is created/verified.
7. Enable WhatsApp auto replies for a controlled tenant.
8. Enable voice notes only after text messaging passes smoke tests.

Calendar OAuth providers can be configured independently when needed for the pilot.
