import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

const time = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// A phone-style preview of the exact template the customer receives, plus a live reply box
// that plays the customer's side (the reply goes through the same handler as Meta's webhook).
export default function WhatsAppPreview({ phone, first }) {
  const [thread, setThread] = useState([{ from: 'brand', kind: 'template', at: time(), ...first.preview }]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef(null);

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [thread]);

  const send = async (message) => {
    if (!message.trim() || busy) return;
    setThread((t) => [...t, { from: 'customer', text: message, at: time() }]);
    setText('');
    setBusy(true);
    try {
      const res = await api.simulateReply(phone, message);
      setThread((t) => [...t, { from: 'brand', text: res.text, at: time() }]);
    } catch (err) {
      setThread((t) => [...t, { from: 'system', text: err.message, at: time() }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wa-wrap">
      <div className="wa-side">
        <h2>Order placed</h2>
        <p className="muted">
          {first.status === 'sent' ? 'Sent through the WhatsApp Cloud API.' : 'Preview mode: this is the exact template payload. Add WhatsApp keys in .env to send it for real.'}
          {first.duplicate && ' (Already sent for this order: one styling message per order.)'}
        </p>
        <p className="muted small">Reply in the phone to try the stylist chat. A reply opens Meta’s 24-hour window, so the agent can answer free-form.</p>
        <details>
          <summary>Template payload</summary>
          <pre>{JSON.stringify(first.payload, null, 2)}</pre>
        </details>
      </div>
      <div className="phone">
        <div className="wa-top">
          <div className="avatar">S</div>
          <div><div className="wa-name">Stylist</div><div className="wa-sub">business account</div></div>
        </div>
        <div className="wa-body">
          {thread.map((m, i) => (
            <div key={i} className={`bubble ${m.from}`}>
              {m.kind === 'template' ? (
                <>
                  <img src={m.image} alt="Outfit collage" />
                  <div className="bubble-text">{m.text}</div>
                  <span className="at">{m.at}</span>
                  <div className="wa-buttons">
                    {m.buttons.map((b) => b.type === 'url'
                      ? <a key={b.text} href={b.url} target="_blank" rel="noreferrer">↗ {b.text}</a>
                      : <button key={b.text} onClick={() => send(b.text)} disabled={busy}>↩ {b.text}</button>)}
                  </div>
                </>
              ) : (
                <>
                  <div className="bubble-text">{m.text}</div>
                  <span className="at">{m.at}</span>
                </>
              )}
            </div>
          ))}
          {busy && <div className="bubble brand typing">typing…</div>}
          <div ref={end} />
        </div>
        <form className="wa-input" onSubmit={(e) => { e.preventDefault(); send(text); }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Reply as the customer…" />
          <button disabled={busy || !text.trim()}>Send</button>
        </form>
      </div>
    </div>
  );
}
