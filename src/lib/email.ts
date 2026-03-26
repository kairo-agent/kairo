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

const followUpI18n = {
  es: {
    subject: (leadName: string) => `KAIRO - Seguimiento pendiente: ${leadName}`,
    heading: 'Seguimiento pendiente',
    body: (leadName: string) =>
      `Tienes un seguimiento programado con <strong>${leadName}</strong>.`,
    scheduled: 'Programado',
    cta: 'Ver en KAIRO',
  },
  en: {
    subject: (leadName: string) => `KAIRO - Follow-up due: ${leadName}`,
    heading: 'Follow-up due',
    body: (leadName: string) =>
      `You have a scheduled follow-up with <strong>${leadName}</strong>.`,
    scheduled: 'Scheduled',
    cta: 'View in KAIRO',
  },
} as const;

const hotLeadI18n = {
  es: {
    subject: (leadName: string) => `KAIRO - Lead de alto potencial: ${leadName}`,
    heading: 'Lead caliente detectado',
    body: (leadName: string, agentName?: string) =>
      agentName
        ? `<strong>${agentName}</strong> ha calificado a <strong>${leadName}</strong> como un lead de <span style="color:#EF4444;font-weight:700;">alto potencial</span>.`
        : `<strong>${leadName}</strong> fue marcado como un lead de <span style="color:#EF4444;font-weight:700;">alto potencial</span>.`,
    cta: 'Ver lead en KAIRO',
  },
  en: {
    subject: (leadName: string) => `KAIRO - High potential lead: ${leadName}`,
    heading: 'Hot lead detected',
    body: (leadName: string, agentName?: string) =>
      agentName
        ? `<strong>${agentName}</strong> has qualified <strong>${leadName}</strong> as a <span style="color:#EF4444;font-weight:700;">high potential</span> lead.`
        : `<strong>${leadName}</strong> was marked as a <span style="color:#EF4444;font-weight:700;">high potential</span> lead.`,
    cta: 'View lead in KAIRO',
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

// ============================================
// Hot lead email builder
// ============================================

function buildHotLeadEmailHtml(params: {
  leadName: string;
  agentName?: string;
  projectName: string;
  leadId: string;
  locale: 'es' | 'en';
}): string {
  const { leadName, agentName, projectName, leadId, locale } = params;
  const t = hotLeadI18n[locale] || hotLeadI18n.es;
  const base = i18n[locale] || i18n.es;
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
              <!-- Hot badge -->
              <div style="margin:0 0 16px;text-align:center;">
                <span style="display:inline-block;background-color:#7F1D1D;color:#FCA5A5;font-size:13px;font-weight:600;padding:4px 14px;border-radius:9999px;letter-spacing:0.5px;">HOT LEAD</span>
              </div>
              <!-- Heading -->
              <h1 style="margin:0 0 20px;font-size:20px;font-weight:600;color:#FFFFFF;text-align:center;">
                ${t.heading}
              </h1>
              <!-- Body text -->
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#D1D5DB;">
                ${t.body(leadName, agentName)}
              </p>
              <!-- Project -->
              <p style="margin:0 0 28px;font-size:14px;color:#9CA3AF;">
                ${base.project}: <strong style="color:#D1D5DB;">${projectName}</strong>
              </p>
              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td align="center" style="background-color:#EF4444;border-radius:8px;">
                    <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:12px 32px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:8px;">
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
                ${base.footer}
                <a href="${profileUrl}" target="_blank" style="color:#00E5FF;text-decoration:underline;">${base.footerLink}</a>.
              </p>
              <p style="margin:0;font-size:11px;color:#4B5563;">
                ${base.footerCopy}
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
// Send hot lead email (fire-and-forget)
// ============================================

export async function sendHotLeadEmail(params: {
  recipientEmail: string;
  ccEmails: string[];
  leadName: string;
  agentName?: string;
  projectName: string;
  leadId: string;
  locale: 'es' | 'en';
}): Promise<void> {
  const client = getResendClient();
  if (!client) return;

  const { recipientEmail, ccEmails, leadName, agentName, projectName, leadId, locale } = params;
  const t = hotLeadI18n[locale] || hotLeadI18n.es;
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
      html: buildHotLeadEmailHtml({ leadName, agentName, projectName, leadId, locale }),
    };

    const validCc = ccEmails.filter((e) => e && e.includes('@'));
    if (validCc.length > 0) {
      emailOptions.cc = validCc;
    }

    await client.emails.send(emailOptions);
    console.log(`[Email] Sent hot lead notification to ${recipientEmail.slice(0, 8)}...`);
  } catch (error) {
    console.error(`[Email] Failed to send hot lead email to ${recipientEmail.slice(0, 8)}...:`, error);
  }
}

// ============================================
// Follow-up email builder
// ============================================

function formatFollowUpDate(dateStr: string, locale: 'es' | 'en', timezone?: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString(locale === 'es' ? 'es-PE' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone || 'America/Lima',
    });
  } catch {
    return '';
  }
}

function buildFollowUpEmailHtml(params: {
  leadName: string;
  projectName: string;
  leadId: string;
  locale: 'es' | 'en';
  scheduledAt?: string;
  timezone?: string;
}): string {
  const { leadName, projectName, leadId, locale, scheduledAt, timezone } = params;
  const t = followUpI18n[locale] || followUpI18n.es;
  const base = i18n[locale] || i18n.es;
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
                ${t.body(leadName)}
              </p>
              ${scheduledAt ? `<!-- Scheduled date -->
              <p style="margin:0 0 8px;font-size:14px;color:#F97316;">
                ${t.scheduled}: <strong>${formatFollowUpDate(scheduledAt, locale, timezone)}</strong>
              </p>` : ''}
              <!-- Project -->
              <p style="margin:0 0 28px;font-size:14px;color:#9CA3AF;">
                ${base.project}: <strong style="color:#D1D5DB;">${projectName}</strong>
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
                ${base.footer}
                <a href="${profileUrl}" target="_blank" style="color:#00E5FF;text-decoration:underline;">${base.footerLink}</a>.
              </p>
              <p style="margin:0;font-size:11px;color:#4B5563;">
                ${base.footerCopy}
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
// Send follow-up email (fire-and-forget)
// ============================================

export async function sendFollowUpEmail(params: {
  recipientEmail: string;
  ccEmails: string[];
  leadName: string;
  projectName: string;
  leadId: string;
  locale: 'es' | 'en';
  scheduledAt?: string;
  timezone?: string;
}): Promise<void> {
  const client = getResendClient();
  if (!client) return;

  const { recipientEmail, ccEmails, leadName, projectName, leadId, locale, scheduledAt, timezone } = params;
  const t = followUpI18n[locale] || followUpI18n.es;
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
      html: buildFollowUpEmailHtml({ leadName, projectName, leadId, locale, scheduledAt, timezone }),
    };

    const validCc = ccEmails.filter((e) => e && e.includes('@'));
    if (validCc.length > 0) {
      emailOptions.cc = validCc;
    }

    await client.emails.send(emailOptions);
    console.log(`[Email] Sent follow-up notification to ${recipientEmail.slice(0, 8)}...`);
  } catch (error) {
    console.error(`[Email] Failed to send follow-up email to ${recipientEmail.slice(0, 8)}...:`, error);
  }
}
