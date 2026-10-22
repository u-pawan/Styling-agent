import { useEffect, useState } from 'react';
import { api } from './api.js';
import Header from './components/Header.jsx';
import Catalog from './components/Catalog.jsx';
import ProductPage from './components/ProductPage.jsx';
import CartDrawer from './components/CartDrawer.jsx';
import Checkout from './components/Checkout.jsx';
import { lineKey } from './cart.js';

const readRoute = () => {
  const p = new URLSearchParams(window.location.search);
  return { product: p.get('product'), occasion: p.get('occasion') };
};

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem('cart') ?? '[]');
  } catch {
    return [];
  }
}

export default function App() {
  const [route, setRoute] = useState(readRoute);
  const [cart, setCart] = useState(loadCart);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [health, setHealth] = useState(null);

  useEffect(() => {
    const onPop = () => setRoute(readRoute());
    window.addEventListener('popstate', onPop);
    api.health().then(setHealth).catch(() => setHealth(null));
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('cart', JSON.stringify(cart));
    } catch {
      // private mode: the cart just won't survive a reload
    }
  }, [cart]);

  const go = (product, occasion) => {
    const url = product ? `?product=${product}${occasion ? `&occasion=${occasion}` : ''}` : window.location.pathname;
    window.history.pushState(null, '', url);
    setRoute({ product, occasion });
    window.scrollTo(0, 0);
  };

  // lines: [{ id, title, price, image, size, sizes, source: 'single' | 'look', lookId? }]
  const addToCart = (lines) => {
    setCart((current) => {
      const next = [...current];
      for (const line of lines) {
        const i = next.findIndex((l) => lineKey(l) === lineKey(line));
        if (i >= 0) {
          next[i] = {
            ...next[i],
            qty: next[i].qty + 1,
            source: next[i].source === 'single' ? 'single' : line.source,
            lookId: next[i].lookId ?? line.lookId,
          };
        }
        else next.push({ ...line, qty: 1 });
      }
      return next;
    });
    setCartOpen(true);
  };

  return (
    <>
      <Header
        storeName={health?.store}
        health={health}
        cartCount={cart.reduce((n, l) => n + l.qty, 0)}
        onCart={() => setCartOpen(true)}
        onHome={() => { setQuery(''); go(null); }}
        onSearch={(q) => { setQuery(q); go(null); }}
      />
      <main>
        {route.product
          ? <ProductPage key={route.product} id={route.product} initialOccasion={route.occasion} onAdd={addToCart} go={go} />
          : <Catalog query={query} go={go} />}
      </main>
      <CartDrawer
        open={cartOpen}
        cart={cart}
        setCart={setCart}
        onClose={() => setCartOpen(false)}
        onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }}
      />
      {checkoutOpen && (
        <Checkout cart={cart} onClose={() => setCheckoutOpen(false)} onPlaced={() => setCart([])} />
      )}
    </>
  );
}
