# Departaj — Supabase Auth email templates & config

On-brand transactional emails (indigo `#4f46e5`, Inter/system fallback, math-paper
dot grid) for Supabase Auth. Table-based, inline styles, no external assets — safe
across Gmail / Outlook / Apple Mail.

## Templates → Supabase mapping

| File | Supabase → Auth → Email Templates | Subject |
|---|---|---|
| `confirm-signup.html` | **Confirm signup** | `Codul tău de confirmare — Departaj` |
| `reset-password.html` | **Reset Password** | `Resetează-ți parola — Departaj` |

`confirm-signup.html` features `{{ .Token }}` (the 6-digit code the app's verify
screen asks for) as the hero, with `{{ .ConfirmationURL }}` as a cross-device
fallback button. **This is the fix for the old blocker** where the default template
only showed the link, not the code.

## Custom SMTP (Resend) — Supabase → Auth → SMTP Settings

Requires a verified sending domain in Resend (DNS: SPF + DKIM, ideally DMARC).

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | `<RESEND_API_KEY>` |
| Sender email | e.g. `no-reply@<your-domain>` |
| Sender name | `Departaj` |

Turn on **"Enable Custom SMTP"**. Without it, Supabase's built-in mailer caps at
~2–3 emails/hour — fine for testing, fatal for a launch.

## Redirect URLs — Supabase → Auth → URL Configuration

- **Site URL:** `https://<your-domain>`  *(you set this already)*
- **Redirect allowlist:** `https://<your-domain>/**`  *(add this — the app's
  PKCE `/auth/callback` and token-hash `/auth/confirm` routes need it)*

## Google provider — Supabase → Auth → Providers → Google

- **Authorized redirect URI** to register in Google Cloud Console:
  `https://qopmafbonhqcqqfvhtgp.supabase.co/auth/v1/callback`
- Paste the OAuth **Client ID** + **Client secret** from Google Cloud, enable the provider.
- App side: set `GOOGLE_AUTH_ENABLED=1` in Vercel so the "Continuă cu Google"
  button renders (`src/app/login/page.tsx` reads this flag).

To preview a template: open the `.html` file in a browser (the `{{ .Token }}` /
`{{ .ConfirmationURL }}` placeholders show literally until Supabase fills them).
