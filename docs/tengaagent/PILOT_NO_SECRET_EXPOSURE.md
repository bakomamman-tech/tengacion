# TengaAgent No-Secret Exposure Check

Before pilot acceptance, verify that:

- readiness endpoints return boolean status only;
- owner UI never renders environment variable values;
- error responses do not echo tokens or authorization headers;
- documentation lists variable names but never stores real values;
- Git history does not contain pilot credentials;
- provider secrets are entered only in Render/provider consoles.
