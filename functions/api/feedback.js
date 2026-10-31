import { boundedText, serviceBudget, serviceJson as json } from '../_service-security.js';

const mailbox = value => typeof value === 'string' && value.length <= 254 && /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(value);
const configured = env => Boolean(env?.RESEND_API_KEY && mailbox(env?.FEEDBACK_TO) && mailbox(env?.FEEDBACK_FROM)
  && env?.COMMUNITY_DB && env?.SERVICE_RATE_SECRET?.length >= 32);

export function onRequestGet({ env }) { return json({ available: configured(env) }); }

export async function onRequestPost({ request, env }) {
  if (!configured(env)) return json({ code: 'DeliveryNotConfigured' }, 503);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ code: 'OriginMismatch' }, 403);
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) return json({ code: 'InvalidInput' }, 400);
  const denied = await serviceBudget(request, env, 'feedback');
  if (denied) return denied;
  let input;
  try { input = JSON.parse(await boundedText(request, 650000)); }
  catch { return json({ code: 'InvalidInput' }, 400); }
  if (!input || !['feedback', 'route', 'privacy'].includes(input.kind) || typeof input.message !== 'string'
    || !input.message.trim() || input.message.length > 5000 || (input.replyTo && !mailbox(input.replyTo))) {
    return json({ code: 'InvalidInput' }, 400);
  }
  let attachment;
  if (input.file) {
    const { name, content } = input.file;
    if (input.kind !== 'route' || typeof name !== 'string' || name.length > 100
      || !/^[\p{L}\p{N}_ .-]+\.(gpx|kml|geojson|json)$/iu.test(name) || name.includes('..')
      || typeof content !== 'string' || new TextEncoder().encode(content).length > 400000 || !content.trim()) {
      return json({ code: 'InvalidInput' }, 400);
    }
    attachment = { filename: name, content: btoa(Array.from(new TextEncoder().encode(content), byte => String.fromCharCode(byte)).join('')) };
  }
  try {
    const result = await fetch('https://api.resend.com/emails', {
      // Workers supports manual/follow, not redirect:"error". Never forward
      // the Authorization header or private message through a redirect.
      method: 'POST', signal: AbortSignal.timeout(10000), redirect: 'manual',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` },
      body: JSON.stringify({ from: env.FEEDBACK_FROM, to: [env.FEEDBACK_TO],
        subject: `Mowaslaty: ${input.kind}`, text: input.message.trim(),
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        ...(attachment ? { attachments: [attachment] } : {}) })
    });
    const accepted = result.ok;
    await result.body?.cancel();
    return accepted ? json({ sent: true }) : json({ code: 'DeliveryUnavailable' }, 502);
  } catch { return json({ code: 'DeliveryUnavailable' }, 502); }
}
