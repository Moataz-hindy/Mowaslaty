// Leaflet treats string popup/tooltip/divIcon content as HTML. Escape every
// dynamic label, including quotes because some labels appear in attributes.
export const escapeMapText = value => String(value ?? '').replace(/[&<>"']/g,
  character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

// Colors interpolated into style attributes must not accept arbitrary CSS.
export const safeMapColor = value => /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)
  ? value : '#15171C';
