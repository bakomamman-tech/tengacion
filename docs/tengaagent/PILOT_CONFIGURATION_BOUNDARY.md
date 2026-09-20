# TengaAgent Pilot Configuration Boundary

The codebase may detect whether external configuration is present, but it must not fabricate or silently default secret credentials.

Allowed defaults:

- safe feature switches defaulting to disabled;
- provider version only when explicitly documented in code/environment policy;
- non-secret callback paths derived from the application URL where supported.

Must be supplied externally:

- database credentials;
- JWT/auth secrets;
- OpenAI API key;
- Meta verify token/app secret/access token;
- calendar encryption key and provider client secrets.

The owner readiness API returns status booleans only. Actual secret management belongs in Render/provider consoles.
