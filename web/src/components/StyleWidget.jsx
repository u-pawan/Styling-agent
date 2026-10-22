import { useCallback, useEffect, useRef, useState } from 'react';
import { api, img, rupees } from '../api.js';
import { categoryLabel } from './Catalog.jsx';

const SLOT_LABEL = { top: 'Top', bottom: 'Bottom', footwear: 'Shoes', layer: 'Layer', accessory: 'Accessory' };
const LETTER = /^(XXS|XS|S|M|L|XL|XXL|XXXL|[2-5]XL)$/i;

// Items join the cart in the shopper's size when it fits that item, otherwise its first size in stock.
function pickSize(item, shopperSize) {
  if (shopperSize && LETTER.test(shopperSize) && item.sizes.includes(shopperSize)) return shopperSize;
  return item.sizes[0] ?? null;
}

function LookCard({ look, index, product, size, onAdd, go }) {
  const add = () => {
    const lookId = `${product.id}-${index}-${Date.now()}`;
    const anchorSize = size ?? product.sizes.find((s) => s.available)?.size;
    onAdd([
      { id: product.id, title: product.title, price: product.price, image: product.image, size: anchorSize,
        sizes: product.sizes.filter((s) => s.available).map((s) => s.size), source: 'single', lookId },
      ...look.items.map((it) => ({
        id: it.id, title: it.title, price: it.price, image: it.image, size: pickSize(it, size), sizes: it.sizes,
        source: 'look', lookId,
      })),
    ]);
  };

  return (
    <article className="look">
      <header>
        <h3>{look.name ?? `Look ${index + 1}`}</h3>
        {look.why && <p>{look.why}</p>}
      </header>
      <div className="look-items">
        <div className="look-item anchor">
          <div className="look-img"><img src={img(product.image, 300)} alt="" /></div>
          <span className="tag">You picked</span>
          <div className="look-title">{product.title}</div>
        </div>
        {look.items.map((it) => (
          <button key={it.id} className="look-item" onClick={() => go(it.id)} title="Open product">
            <div className="look-img"><img src={img(it.image, 300)} alt="" loading="lazy" /></div>
            <span className="tag">{SLOT_LABEL[it.slot]} · {categoryLabel(it.category)}</span>
            <div className="look-title">{it.title}</div>
            <div className="price">{rupees(it.price)}</div>
          </button>
        ))}
      </div>
      {look.advice.length > 0 && (
        <div className="advice">
          {look.advice.map((a) => <span key={a.slot}>Tip: pair with {a.text}</span>)}
        </div>
      )}
      <footer>
        <div>
          <div className="muted small">Full look</div>
          <div className="price"><s>{rupees(look.total)}</s> {rupees(look.bundlePrice)} <span className="off">10% off together</span></div>
        </div>
        <button className="primary" onClick={add}>Add full look</button>
      </footer>
    </article>
  );
}

export default function StyleWidget({ product, size, initialOccasion, onAdd, go }) {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(initialOccasion ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ask, setAsk] = useState('');
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const load = useCallback(async (occasion) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.looks(product.id, { ...(occasion ? { occasion } : {}), ...(size ? { size } : {}) });
      setData(res);
      setSelected(res.occasion);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [product.id, size]);

  useEffect(() => { load(selectedRef.current); }, [load]);

  const choose = (key) => { setSelected(key); load(key); };

  const submitAsk = async (e) => {
    e.preventDefault();
    if (!ask.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.chat(product.id, ask.trim(), size);
      setData(res);
      setSelected(res.occasion);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (data && !data.occasions?.length) return null; // accessories etc.

  return (
    <section className="stylist">
      <div className="stylist-head">
        <div>
          <h2>Complete the look</h2>
          <p className="muted">{loading ? 'Styling from in-stock pieces…' : data?.intro}</p>
        </div>
        {data && !loading && (
          <span className="meta">{data.cached ? 'cached' : `${data.ms} ms`} · copy by {data.copySource === 'llm' ? 'local LLM' : 'template'}</span>
        )}
      </div>

      <div className="chips">
        <span className="label">Where are you wearing it?</span>
        {(data?.occasions ?? []).map((o) => (
          <button key={o.key} className={`chip ${selected === o.key ? 'active' : ''}`} onClick={() => choose(o.key)} disabled={loading}>
            {o.label}{o.suggested && <i className="dot" title="Suggested for this piece" />}
          </button>
        ))}
      </div>

      <form className="ask" onSubmit={submitAsk}>
        <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Or tell the stylist: cousin's sangeet, no black please" />
        <button className="secondary" disabled={loading}>Ask</button>
      </form>
      {data?.understood && (
        <p className="muted small">
          Understood as <b>{data.occasionLabel}</b>
          {data.understood.prefer?.colors?.length ? `, prefers ${data.understood.prefer.colors.join(', ')}` : ''}
          {data.understood.prefer?.avoidColors?.length ? `, avoids ${data.understood.prefer.avoidColors.join(', ')}` : ''}
        </p>
      )}

      {error && <p className="error">{error}</p>}
      <div className={`looks ${loading ? 'loading' : ''}`}>
        {loading && !data && Array.from({ length: 3 }, (_, i) => <div key={i} className="look skeleton" />)}
        {data?.looks.map((look, i) => (
          <LookCard key={`${data.occasion}-${i}-${look.items.map((x) => x.id).join()}`} look={look} index={i} product={product} size={size} onAdd={onAdd} go={go} />
        ))}
      </div>
    </section>
  );
}
