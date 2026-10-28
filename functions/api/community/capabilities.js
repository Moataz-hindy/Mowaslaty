import { config, json, publishing } from './_shared.js';
export function onRequestGet({
  env
}) {
  const cfg = config(env);
  if (!cfg) return json({
    authenticationAvailable: false,
    publishingAvailable: false
  });
  return json({
    authenticationAvailable: true,
    publishingAvailable: publishing(env),
    auth: {
      url: cfg.url,
      publishableKey: cfg.key,
      provider: 'google'
    }
  });
}
