import { useEffect, useState } from 'react';
import { api, img, rupees } from '../api.js';
import StyleWidget from './StyleWidget.jsx';

export default function ProductPage({ id, initialOccasion, onAdd, go }) {
  const [p, setP] = useState(null);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(0);
  const [size, setSize] = useState(null);
  const [needSize, setNeedSize] = useState(false);

  useEffect(() => {
    api.product(id).then(setP).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="error page">{error}</p>;
  if (!p) return <div className="page product-layout"><div className="gallery skeleton" /><div /></div>;

  const available = p.sizes.filter((s) => s.available).map((s) => s.size);

  const addSingle = () => {
    if (!size) { setNeedSize(true); return; }
    onAdd([{ id: p.id, title: p.title, price: p.price, image: p.image, size, sizes: available, source: 'single' }]);
  };

  return (
    <div className="page">
      <button className="back" onClick={() => go(null)}>← All products</button>
      <div className="product-layout">
        <div className="gallery">
          <div className="gallery-main"><img src={img(p.images[active] ?? p.image, 900)} alt={p.title} /></div>
          <div className="thumbs">
            {p.images.map((src, i) => (
              <button key={src} className={i === active ? 'active' : ''} onClick={() => setActive(i)}>
                <img src={img(src, 160)} alt="" />
              </button>
            ))}
          </div>
        </div>
        <div className="details">
          <h1>{p.title}</h1>
          <div className="price big">
            {rupees(p.price)}
            {p.compareAtPrice > p.price && <><s>{rupees(p.compareAtPrice)}</s><span className="off">{Math.round((1 - p.price / p.compareAtPrice) * 100)}% off</span></>}
          </div>
          <dl className="attrs">
            {p.color && <><dt>Colour</dt><dd>{p.color}</dd></>}
            {p.fit && <><dt>Fit</dt><dd>{p.fit}</dd></>}
            {p.fabric && <><dt>Fabric</dt><dd>{p.fabric}</dd></>}
          </dl>
          <div className="sizes">
            <div className="label">Size {needSize && !size && <span className="error">Pick a size</span>}</div>
            {p.sizes.map((s) => (
              <button
                key={s.variantId}
                disabled={!s.available}
                className={`size ${size === s.size ? 'active' : ''}`}
                onClick={() => { setSize(s.size); setNeedSize(false); }}
              >
                {s.size}
              </button>
            ))}
          </div>
          <button className="primary wide" onClick={addSingle}>Add to cart</button>
          {p.styleNote && <p className="style-note">Stylist note: {p.styleNote}</p>}
          <p className="muted small">{p.description?.slice(0, 260)}{p.description?.length > 260 ? '…' : ''}</p>
        </div>
      </div>
      <StyleWidget product={p} size={size} initialOccasion={initialOccasion} onAdd={onAdd} go={go} />
    </div>
  );
}
