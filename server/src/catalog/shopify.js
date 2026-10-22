// Reads a Shopify store's public product feed (/products.json), page by page.
// Used for private demos on a prospect's own catalog; real clients connect via the Admin API.

const PAGE_SIZE = 250;

export async function fetchAllProducts(storeUrl, { maxPages = 60, onPage } = {}) {
  const all = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `${storeUrl}/products.json?limit=${PAGE_SIZE}&page=${page}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (styling-agent demo importer)' } });
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
    const { products } = await res.json();
    if (!products?.length) break;
    all.push(...products);
    onPage?.(page, products.length, all.length);
    if (products.length < PAGE_SIZE) break;
  }
  return all;
}
