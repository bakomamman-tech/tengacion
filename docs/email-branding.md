# Tengacion Email Branding

Tengacion transactional emails are sent through the shared backend mail helpers:

- `backend/utils/sendOtpEmail.js`
- `backend/utils/sendSecurityEmail.js`
- `backend/utils/sendBrandedEmail.js`

Every message sent through these helpers is wrapped in a branded email template with the Tengacion logo. The logo URL is controlled by `EMAIL_LOGO_URL` and defaults to:

```text
https://tengacion.com/tengacion_logo_512.png
```

## Gmail Inbox Logo

The logo shown beside a sender in the Gmail message list is not controlled by email HTML. Gmail displays that sender-logo treatment through domain identity signals such as Google account profile images and, for broad brand display, BIMI.

For Tengacion to show a brand logo like larger verified senders:

1. Send mail from an address on the Tengacion domain, for example `stephen@tengacion.com`.
2. Configure SPF and DKIM for every SMTP provider allowed to send as `tengacion.com`.
3. Configure DMARC for `tengacion.com`. BIMI requires a DMARC policy of `p=quarantine` or `p=reject` with `pct=100`.
4. Prepare a BIMI-compatible SVG Tiny PS logo. Gmail expects absolute pixel dimensions, at least 96 by 96 pixels, centered in a square, and a solid background is recommended.
5. Get a Verified Mark Certificate or Common Mark Certificate from a supported certificate authority. A VMC is recommended when the logo is trademarked.
6. Host the issued PEM file, and any required logo file, on a public HTTPS URL.
7. Add the BIMI TXT record at `default._bimi.tengacion.com`.

Example BIMI TXT record shape:

```text
default._bimi.tengacion.com TXT "v=BIMI1;l=;a=https://tengacion.com/brand/tengacion-bimi.pem"
```

After DNS is added, mailbox providers can take time to display the logo, and display is still affected by authentication, sender reputation, and recipient mailbox behavior.

## Production Checklist

- Keep `EMAIL_FROM` aligned with the authenticated sending domain.
- Keep `EMAIL_LOGO_URL` public and HTTPS in production.
- Use Render secrets for `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS`.
- Send a test OTP and a password reset email after each mail-provider change.
- Verify SPF, DKIM, and DMARC before turning DMARC enforcement up to `quarantine` or `reject`.
