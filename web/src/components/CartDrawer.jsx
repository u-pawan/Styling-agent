import { img, rupees } from '../api.js';
import { lineKey } from '../cart.js';

const LOOK_DISCOUNT = 0.1;

export function cartTotals(cart) {
  const sum = (lines) => lines.reduce((s, l) => s + l.price * l.qty, 0);
  const subtotal = sum(cart);
  const discount = Math.round(sum(cart.filter((l) => l.lookId)) * LOOK_DISCOUNT);
  const base = sum(cart.filter((l) => l.source === 'single'));
  const styled = sum(cart.filter((l) => l.source === 'look'));
  return { subtotal, discount, total: subtotal - discount, base, styled };
}

export default function CartDrawer({ open, cart, setCart, onClose, onCheckout }) {
  const t = cartTotals(cart);
  const update = (key, patch) => setCart((c) => c.map((l) => (lineKey(l) === key ? { ...l, ...patch } : l)).filter((l) => l.qty > 0));

  return (
    <>
      <div className={`scrim ${open ? 'show' : ''}`} onClick={onClose} />
      <aside className={`drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="drawer-head">
          <h2>Your cart</h2>
          <button className="ghost" onClick={onClose} aria-label="Close cart">✕</button>
        </div>
        {cart.length === 0 && <p className="muted">Your cart is empty.</p>}
        <ul className="lines">
          {cart.map((l) => {
            const key = lineKey(l);
            return (
              <li key={key}>
                <img src={img(l.image, 160)} alt="" />
                <div className="line-body">
                  <div className="line-title">{l.title}</div>
                  <div className="line-meta">
                    {l.sizes?.length > 0 && (
                      <select value={l.size ?? ''} onChange={(e) => update(key, { size: e.target.value })} aria-label="Size">
                        {l.sizes.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                    {l.source === 'look' && <span className="pill">from a look</span>}
                  </div>
                  <div className="qty">
                    <button onClick={() => update(key, { qty: l.qty - 1 })} aria-label="Remove one">−</button>
                    <span>{l.qty}</span>
                    <button onClick={() => update(key, { qty: l.qty + 1 })} aria-label="Add one">+</button>
                  </div>
                </div>
                <div className="price">{rupees(l.price * l.qty)}</div>
              </li>
            );
          })}
        </ul>
        {cart.length > 0 && (
          <div className="totals">
            <div><span>Subtotal</span><span>{rupees(t.subtotal)}</span></div>
            {t.discount > 0 && <div className="good"><span>Look discount</span><span>−{rupees(t.discount)}</span></div>}
            <div className="grand"><span>Total</span><span>{rupees(t.total)}</span></div>
            {t.styled > 0 && t.base > 0 && (
              <div className="aov">
                Styling added {rupees(t.styled)} to this order (+{Math.round((t.styled / t.base) * 100)}% order value)
              </div>
            )}
            <button className="primary wide" onClick={onCheckout}>Checkout</button>
          </div>
        )}
      </aside>
    </>
  );
}
