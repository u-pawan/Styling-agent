import { useEffect, useState } from 'react';
import { api, img, rupees } from '../api.js';

const LABELS = {
  shirt: 'Shirts', tshirt: 'T-shirts', polo: 'Polos', kurta: 'Kurtas', jeans: 'Jeans', trousers: 'Trousers',
  chinos: 'Chinos', cargo: 'Cargos', shorts: 'Shorts', joggers: 'Joggers', overshirt: 'Overshirts', jacket: 'Jackets',
  blazer: 'Blazers', sweater: 'Sweaters', sweatshirt: 'Sweatshirts', hoodie: 'Hoodies', sneakers: 'Sneakers',
  loafers: 'Loafers', formal_shoes: 'Formal shoes', boots: 'Boots', mules: 'Mules', sandals: 'Sandals',
  belt: 'Belts', sunglasses: 'Sunglasses', bag: 'Bags', cap: 'Caps', jewellery: 'Jewellery', watch: 'Watches',
};
export const categoryLabel = (c) => LABELS[c] ?? c;

export function ProductCard({ p, onOpen }) {
  return (
    <button className="card" onClick={onOpen}>
      <div className="card-img"><img src={img(p.image, 400)} alt="" loading="lazy" /></div>
      <div className="card-body">
        <div className="card-title">{p.title}</div>
        <div className="price">
          {rupees(p.price)}
          {p.compareAtPrice > p.price && <s>{rupees(p.compareAtPrice)}</s>}
        </div>
      </div>
    </button>
  );
}

export default function Catalog({ query, go }) {
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('shirt');
  const [products, setProducts] = useState(null);
  const [mode, setMode] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { api.categories().then(setCategories).catch(() => {}); }, []);

  useEffect(() => {
    setProducts(null);
    setError(null);
    const params = query ? { q: query, limit: 48 } : { category, limit: 60 };
    api.products(params)
      .then((r) => { setProducts(r.products); setMode(r.search); })
      .catch((e) => setError(e.message));
  }, [query, category]);

  return (
    <section className="catalog">
      {query ? (
        <div className="catalog-head">
          <h1>Results for “{query}”</h1>
          {mode === 'vector' && <p className="muted">Matched by meaning with pgvector, not just keywords.</p>}
        </div>
      ) : (
        <div className="chips scroll">
          {categories.map((c) => (
            <button key={c.category} className={`chip ${c.category === category ? 'active' : ''}`} onClick={() => setCategory(c.category)}>
              {categoryLabel(c.category)} <span className="muted">{c.n}</span>
            </button>
          ))}
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {!products && !error && <div className="grid">{Array.from({ length: 8 }, (_, i) => <div key={i} className="card skeleton" />)}</div>}
      {products && (
        <div className="grid">
          {products.map((p) => <ProductCard key={p.id} p={p} onOpen={() => go(p.id)} />)}
        </div>
      )}
      {products?.length === 0 && <p className="muted">Nothing found.</p>}
    </section>
  );
}
