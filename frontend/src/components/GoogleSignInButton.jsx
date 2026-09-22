// Google Identity Services sign-in button (Phase 3).
// Renders the official GIS button ("Sign in with Google" /
// "Continue with Google") and forwards ONLY the ID token credential
// to the backend - profile claims are never trusted client-side.
// Fails safe: without VITE_GOOGLE_CLIENT_ID or when the Google script
// cannot load, nothing renders and password login keeps working.
// The credential lives only in the GIS callback (never storage/URL/logs).
import { useEffect, useRef, useState } from 'react';

const GIS_SRC = 'https://accounts.google.com/gsi/client';

let scriptPromise = null;
function loadGisScript() {
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('no document'));
  }
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = GIS_SRC;
      el.async = true;
      el.defer = true;
      el.onload = () => resolve();
      el.onerror = () => {
        scriptPromise = null;
        reject(new Error('gis load failed'));
      };
      document.head.appendChild(el);
    });
  }
  return scriptPromise;
}

function buttonWidth(box) {
  const parentWidth = box?.parentElement?.clientWidth || 0;
  return Math.max(200, Math.min(parentWidth || 300, 400));
}

export default function GoogleSignInButton({ text, onCredential, disabled }) {
  const boxRef = useRef(null);
  const cbRef = useRef(null);
  const widthRef = useRef(0);
  // Keep the GIS callback fresh without re-initializing on every render.
  useEffect(() => {
    cbRef.current = onCredential;
  });
  const [ready, setReady] = useState(false);
  // Remounting the slot div gives GIS a fresh empty container, so no
  // manual DOM clearing is ever needed (used on width changes only).
  const [slot, setSlot] = useState(0);
  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();

  useEffect(() => {
    if (!clientId) return undefined;
    let cancelled = false;
    function render() {
      if (cancelled || !boxRef.current || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (res) => {
          if (res?.credential) cbRef.current?.(res.credential);
        },
        auto_select: false,
      });
      widthRef.current = buttonWidth(boxRef.current);
      window.google.accounts.id.renderButton(boxRef.current, {
        theme: 'outline',
        size: 'large',
        width: widthRef.current,
        text: text || 'signin_with',
      });
      setReady(true);
    }
    function onResize() {
      // Re-render only when the width bucket actually changed, so
      // window drags do not thrash the GIS button.
      const w = buttonWidth(boxRef.current);
      if (w !== widthRef.current) setSlot((s) => s + 1);
    }
    loadGisScript().then(render).catch(() => {});
    window.addEventListener('resize', onResize);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', onResize);
      try {
        window.google?.accounts?.id?.cancel();
      } catch {
        // GIS teardown is best-effort; the page works without it.
      }
    };
  }, [clientId, text, slot]);

  if (!clientId) return null;
  return (
    <div className="d-flex justify-content-center">
      <div
        key={slot}
        ref={boxRef}
        aria-hidden={!ready || disabled}
        style={disabled ? { pointerEvents: 'none', opacity: 0.6 } : undefined}
      />
    </div>
  );
}
