import { json } from './_shared.js';
export async function onRequest({
  request,
  next
}) {
  const response = await next();
  if (response.status === 405 && !(response.headers.get('content-type') || '').includes('application/json')) return json({
    code: 'MethodNotAllowed'
  }, 405);
  return response;
}
