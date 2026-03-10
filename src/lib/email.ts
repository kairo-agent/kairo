import { Resend } from 'resend';

// ============================================
// Resend client singleton
// ============================================

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY not configured, skipping email');
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

// ============================================
// i18n strings
// ============================================

const i18n = {
  es: {
    subject: (leadName: string) => `KAIRO - ${leadName} requiere atencion humana`,
    heading: 'Transferencia de conversacion',
    body: (agentName: string, leadName: string) =>
      `<strong>${agentName}</strong> ha transferido la conversacion con <strong>${leadName}</strong> a un asesor humano.`,
    project: 'Proyecto',
    cta: 'Ver en KAIRO',
    footer: 'Puedes desactivar las notificaciones por email en tu',
    footerLink: 'configuracion de perfil',
    footerCopy: 'KAIRO - Sistema de Gestion de Leads con IA',
  },
  en: {
    subject: (leadName: string) => `KAIRO - ${leadName} requires human attention`,
    heading: 'Conversation transfer',
    body: (agentName: string, leadName: string) =>
      `<strong>${agentName}</strong> has transferred the conversation with <strong>${leadName}</strong> to a human advisor.`,
    project: 'Project',
    cta: 'View in KAIRO',
    footer: 'You can disable email notifications in your',
    footerLink: 'profile settings',
    footerCopy: 'KAIRO - AI-Powered Lead Management System',
  },
} as const;

// ============================================
// HTML email builder
// ============================================

function buildHandoffEmailHtml(params: {
  leadName: string;
  agentName: string;
  projectName: string;
  leadId: string;
  locale: 'es' | 'en';
}): string {
  const { leadName, agentName, projectName, leadId, locale } = params;
  const t = i18n[locale] || i18n.es;
  const ctaUrl = `https://app.kairoagent.com/${locale}/leads?leadId=${encodeURIComponent(leadId)}`;
  const profileUrl = `https://app.kairoagent.com/${locale}/profile`;

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.subject(leadName)}</title>
</head>
<body style="margin:0;padding:0;background-color:#0B1220;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0B1220;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <span style="font-size:28px;font-weight:700;color:#00E5FF;letter-spacing:4px;">KAIRO</span>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background-color:#111827;border-radius:12px;padding:32px;border:1px solid #1F2937;">
              <!-- Heading -->
              <h1 style="margin:0 0 20px;font-size:20px;font-weight:600;color:#FFFFFF;">
                ${t.heading}
              </h1>
              <!-- Body text -->
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#D1D5DB;">
                ${t.body(agentName, leadName)}
              </p>
              <!-- Project -->
              <p style="margin:0 0 28px;font-size:14px;color:#9CA3AF;">
                ${t.project}: <strong style="color:#D1D5DB;">${projectName}</strong>
              </p>
              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td align="center" style="background-color:#00E5FF;border-radius:8px;">
                    <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:12px 32px;font-size:15px;font-weight:600;color:#0B1220;text-decoration:none;border-radius:8px;">
                      ${t.cta}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0 0 8px;font-size:12px;color:#6B7280;">
                ${t.footer}
                <a href="${profileUrl}" target="_blank" style="color:#00E5FF;text-decoration:underline;">${t.footerLink}</a>.
              </p>
              <p style="margin:0;font-size:11px;color:#4B5563;">
                ${t.footerCopy}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ============================================
// Send handoff email (fire-and-forget)
// ============================================

export async function sendHandoffEmail(params: {
  recipientEmail: string;
  ccEmails: string[];
  leadName: string;
  agentName: string;
  projectName: string;
  leadId: string;
  locale: 'es' | 'en';
}): Promise<void> {
  const client = getResendClient();
  if (!client) return;

  const { recipientEmail, ccEmails, leadName, agentName, projectName, leadId, locale } = params;
  const t = i18n[locale] || i18n.es;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'KAIRO <no-reply@kairoagent.com>';

  try {
    const emailOptions: {
      from: string;
      to: string;
      cc?: string[];
      subject: string;
      html: string;
    } = {
      from: fromEmail,
      to: recipientEmail,
      subject: t.subject(leadName),
      html: buildHandoffEmailHtml({ leadName, agentName, projectName, leadId, locale }),
    };

    // Only add cc if there are valid emails
    const validCc = ccEmails.filter((e) => e && e.includes('@'));
    if (validCc.length > 0) {
      emailOptions.cc = validCc;
    }

    await client.emails.send(emailOptions);
    console.log(`[Email] Sent handoff notification to ${recipientEmail.slice(0, 8)}...`);
  } catch (error) {
    // Fire-and-forget: log but never throw
    console.error(`[Email] Failed to send to ${recipientEmail.slice(0, 8)}...:`, error);
  }
}
