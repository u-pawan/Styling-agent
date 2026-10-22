import { useState } from 'react';

export default function Header({ storeName, health, cartCount, onCart, onHome, onSearch }) {
  const [text, setText] = useState('');
  const aiOn = health?.ollama;
  return (
    <header className="header">
      <button className="brand" onClick={onHome}>
        <span className="brand-mark">Styling Agent</span>
        <span className="brand-sub">{storeName ? `${storeName} catalog · private demo` : 'private demo'}</span>
      </button>
      <form className="search" onSubmit={(e) => { e.preventDefault(); onSearch(text.trim()); }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search by vibe: linen shirt for a beach wedding"
          aria-label="Search products"
        />
      </form>
      <span className={`status ${aiOn ? 'on' : 'off'}`} title={health ? `Models: ${Object.values(health.models).join(', ')}` : ''}>
        {aiOn ? 'Local AI on' : 'AI offline'}
      </span>
      <button className="cart-btn" onClick={onCart}>
        Cart{cartCount ? <span className="badge">{cartCount}</span> : null}
      </button>
    </header>
  );
}
