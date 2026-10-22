import { useState } from 'react';
import { api, rupees } from '../api.js';
import { cartTotals } from './CartDrawer.jsx';
import WhatsAppPreview from './WhatsAppPreview.jsx';

export default function Checkout({ cart, onClose, onPlaced }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('91');
  const [optIn, setOptIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const t = cartTotals(cart);
  const main = cart.find((l) => l.source === 'single') ?? cart[0];

  const place = async (e) => {
    e.preventDefault();
    setError(null);
    if (!/^\d{12}$/.test(phone)) { setError('Enter the number with country code, e.g. 919812345678'); return; }
    setBusy(true);
    try {
      let message = null;
      if (optIn && main) {
        await api.optIn(phone, name);
        message = await api.simulateOrder(main.id, phone);
      }
      setResult({ message });
      onPlaced();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-wrap" role="dialog" aria-modal="true">
      <div className="scrim show" onClick={onClose} />
      <div className={`modal ${result?.message ? 'wide' : ''}`}>
        <button className="ghost close" onClick={onClose} aria-label="Close">✕</button>
        {!result && (
          <form onSubmit={place}>
            <h2>Checkout</h2>
            <p className="muted">{cart.reduce((n, l) => n + l.qty, 0)} items · {rupees(t.total)}</p>
            <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rahul" /></label>
            <label>WhatsApp number<input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} inputMode="numeric" /></label>
            <label className="check">
              <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
              Send me styling tips for this order on WhatsApp
            </label>
            {error && <p className="error">{error}</p>}
            <button className="primary wide" disabled={busy || !cart.length}>{busy ? 'Placing order…' : 'Place demo order'}</button>
            <p className="muted small">Demo only: no payment is taken. Without the tick, no WhatsApp message is sent.</p>
          </form>
        )}
        {result && !result.message && (
          <div>
            <h2>Order placed</h2>
            <p className="muted">The customer did not opt in, so no WhatsApp message goes out.</p>
          </div>
        )}
        {result?.message && <WhatsAppPreview phone={phone} first={result.message} />}
      </div>
    </div>
  );
}
