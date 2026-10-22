# Web (demo shop)

React 19 + Vite. A small storefront for showing the styling agent to brands: catalog, product page with the **Complete the look** widget, cart with bundle discount and order-value uplift, and a checkout that previews the WhatsApp styling message.

## Run

The API must be running on :4000; Vite proxies `/api` and `/collages` to it.

```bash
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serves dist/ on :4173 (use this behind a share tunnel)
```

`*.trycloudflare.com` hosts are allowed in `vite.config.js` so the demo can be shared through a Cloudflare quick tunnel.

## Components

| File | What it shows |
| --- | --- |
| `App.jsx` | Routing by `?product=&occasion=` (WhatsApp links land here), cart state in localStorage |
| `components/Header.jsx` | Meaning search box, local-AI status, cart button |
| `components/Catalog.jsx` | Category chips and product grid; search results |
| `components/ProductPage.jsx` | Gallery, sizes, add to cart, stylist note |
| `components/StyleWidget.jsx` | Occasion chips, free-text "ask the stylist", look cards, "Add full look" |
| `components/CartDrawer.jsx` | Lines with size picker, look discount, "styling added ₹X" |
| `components/Checkout.jsx` | Name, WhatsApp number, explicit opt-in tick |
| `components/WhatsAppPreview.jsx` | Phone mock-up of the template, plus a reply box that plays the customer |
