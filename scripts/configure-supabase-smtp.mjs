/**
 * Configure IronStack Supabase Auth: Gmail SMTP, branded templates, rate limits.
 *
 * Prerequisites:
 *   1. Supabase Personal Access Token (Owner/Admin) from
 *      https://supabase.com/dashboard/account/tokens
 *   2. Gmail App Password in SMTP_APP_PASSWORD (not your main Gmail password)
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_ACCESS_TOKEN="sbp_..."
 *   $env:SMTP_APP_PASSWORD="xxxx xxxx xxxx xxxx"
 *   node scripts/configure-supabase-smtp.mjs
 *
 * Optional flags:
 *   --enable-confirm     Turn OFF mailer_autoconfirm (require email verification)
 *   --autoconfirm        Turn ON mailer_autoconfirm (instant sign-up, no confirm email)
 *   --dry-run            Print payload without PATCH
 *   --rate-limit=200     Auth emails per hour (default 200)
 */

const PROJECT_REF = 'jasxefogqpqkpzgjcxht'
const SMTP_USER = 'iron.stack.web@gmail.com'
const SMTP_SENDER = 'iron.stack.web@gmail.com'
const SMTP_SENDER_NAME = 'IronStack'

const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const enableConfirm = args.has('--enable-confirm')
const autoconfirm = args.has('--autoconfirm')
const rateLimitArg = [...args].find((a) => a.startsWith('--rate-limit='))
const rateLimitRaw = rateLimitArg
  ? Number(rateLimitArg.split('=')[1])
  : 200
const rateLimit = Number.isFinite(rateLimitRaw)
  ? Math.max(1, Math.floor(rateLimitRaw))
  : 200

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim()
const smtpPass = process.env.SMTP_APP_PASSWORD?.replace(/\s+/g, '').trim()

if (!token) {
  console.error('Missing SUPABASE_ACCESS_TOKEN.')
  console.error('Create one at https://supabase.com/dashboard/account/tokens')
  process.exit(1)
}
if (!smtpPass) {
  console.error('Missing SMTP_APP_PASSWORD (Gmail App Password).')
  process.exit(1)
}

const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`

const emailShell = (title, bodyHtml, ctaLabel) => `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0E0E10;color:#F7F6F3;padding:32px 16px;">
  <div style="max-width:520px;margin:0 auto;background:#16161A;border:1px solid rgba(198,40,40,0.25);border-radius:16px;padding:28px 24px;">
    <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.18em;color:#C62828;font-weight:700;">IRONSTACK</p>
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#F7F6F3;">${title}</h1>
    <div style="font-size:15px;line-height:1.6;color:#B8B6B0;">${bodyHtml}</div>
    <p style="margin:28px 0 0;text-align:center;">
      <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#C62828;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:0.12em;padding:14px 24px;border-radius:999px;">${ctaLabel}</a>
    </p>
    <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#7A7874;">If you did not request this, you can safely ignore this email.</p>
  </div>
</div>`.trim()

const payload = {
  external_email_enabled: true,
  smtp_host: 'smtp.gmail.com',
  smtp_port: '587',
  smtp_user: SMTP_USER,
  smtp_pass: smtpPass,
  smtp_admin_email: SMTP_SENDER,
  smtp_sender_name: SMTP_SENDER_NAME,
  rate_limit_email_sent: rateLimit,
  mailer_subjects_confirmation: 'Confirm your IronStack account',
  mailer_templates_confirmation_content: emailShell(
    'Confirm your email',
    '<p>Thanks for signing up. Tap the button below to verify your email and finish creating your account.</p>',
    'CONFIRM EMAIL',
  ),
  mailer_subjects_recovery: 'Reset your IronStack password',
  mailer_templates_recovery_content: emailShell(
    'Reset your password',
    '<p>We received a request to reset the password for your IronStack account.</p>',
    'RESET PASSWORD',
  ),
  mailer_subjects_magic_link: 'Your IronStack sign-in link',
  mailer_templates_magic_link_content: emailShell(
    'Sign in to IronStack',
    '<p>Use the button below to sign in. This link expires soon and works once.</p>',
    'SIGN IN',
  ),
  mailer_subjects_invite: 'You\'re invited to IronStack',
  mailer_templates_invite_content: emailShell(
    'You\'re invited',
    '<p>You\'ve been invited to join IronStack. Accept the invitation to create your account.</p>',
    'ACCEPT INVITE',
  ),
  mailer_subjects_email_change: 'Confirm your new IronStack email',
  mailer_templates_email_change_content: emailShell(
    'Confirm new email',
    '<p>Confirm <strong>{{ .NewEmail }}</strong> as the new email for your IronStack account.</p>',
    'CONFIRM NEW EMAIL',
  ),
}

if (enableConfirm && autoconfirm) {
  console.error('Use only one of --enable-confirm or --autoconfirm.')
  process.exit(1)
}

if (enableConfirm) {
  payload.mailer_autoconfirm = false
  console.log('Will DISABLE mailer_autoconfirm (email confirmation required).')
} else if (autoconfirm) {
  payload.mailer_autoconfirm = true
  console.log('Will ENABLE mailer_autoconfirm (instant sign-up, no confirm email).')
} else {
  console.log(
    'Leaving mailer_autoconfirm unchanged (pass --autoconfirm or --enable-confirm).',
  )
}

async function main() {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  const before = await fetch(API, { headers })
  if (!before.ok) {
    console.error('GET auth config failed:', before.status, await before.text())
    process.exit(1)
  }
  const current = await before.json()
  console.log('Current SMTP host:', current.smtp_host || '(default)')
  console.log('Current mailer_autoconfirm:', current.mailer_autoconfirm)
  console.log('Current rate_limit_email_sent:', current.rate_limit_email_sent)

  const patchBody = { ...payload }
  if (!enableConfirm && !autoconfirm) {
    delete patchBody.mailer_autoconfirm
  }

  if (dryRun) {
    console.log('\nDry run — would PATCH:')
    console.log(
      JSON.stringify(
        { ...patchBody, smtp_pass: '[REDACTED]' },
        null,
        2,
      ),
    )
    return
  }

  const res = await fetch(API, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(patchBody),
  })
  const text = await res.text()
  if (!res.ok) {
    console.error('PATCH failed:', res.status, text)
    process.exit(1)
  }

  console.log('\nSMTP + templates configured successfully.')
  console.log('Sender:', `${SMTP_SENDER_NAME} <${SMTP_SENDER}>`)
  console.log('Rate limit (emails/hour):', rateLimit)
  if (autoconfirm) {
    console.log('mailer_autoconfirm: true (sign-up returns a session immediately).')
  } else if (!enableConfirm) {
    console.log('\nTip: pass --autoconfirm to skip confirm-email on sign-up.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
