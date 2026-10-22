async function request(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

export const api = {
  health: () => request('/api/health'),
  categories: () => request('/api/categories'),
  products: (params = {}) => request(`/api/products?${new URLSearchParams(params)}`),
  product: (id) => request(`/api/products/${id}`),
  looks: (id, params = {}) => request(`/api/products/${id}/looks?${new URLSearchParams(params)}`),
  chat: (productId, message, size) => request('/api/stylist/chat', { method: 'POST', body: { productId, message, size } }),
  optIn: (phone, name) => request('/api/whatsapp/optin', { method: 'POST', body: { phone, name } }),
  simulateOrder: (productId, phone) => request('/api/orders/simulate', { method: 'POST', body: { productId, phone } }),
  simulateReply: (phone, text) => request('/api/whatsapp/simulate-reply', { method: 'POST', body: { phone, text } }),
};

export const rupees = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;

// Shopify's CDN resizes on the fly; small images keep the demo fast.
export const img = (url, width = 500) =>
  url?.includes('cdn.shopify.com') ? `${url}${url.includes('?') ? '&' : '?'}width=${width}` : url;
