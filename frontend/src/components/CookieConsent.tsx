'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type CookieChoice = 'all' | 'necessary';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const panelRef = useRef<HTMLElement>(null);

  const choose = useCallback((choice: CookieChoice) => {
    window.localStorage.setItem('umutungo-cookie-consent', JSON.stringify({ choice, updatedAt: new Date().toISOString() }));
    setVisible(false);
  }, []);

  useEffect(() => {
    setVisible(!window.localStorage.getItem('umutungo-cookie-consent'));
  }, []);

  useEffect(() => {
    if (!visible) return;
    const dismissOutside = (event: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) choose('necessary');
    };
    document.addEventListener('pointerdown', dismissOutside, true);
    return () => document.removeEventListener('pointerdown', dismissOutside, true);
  }, [visible, choose]);

  if (!visible) return null;
  return <aside ref={panelRef} className="cookie-consent" aria-label="Cookie consent"><div className="cookie-consent-copy"><strong>Cookie settings</strong><p>Essential cookies keep sign-in and saved homes working. Optional cookies help us understand site use.</p></div>{preferencesOpen && <div className="cookie-preference-list"><label><input type="checkbox" checked readOnly /> Essential cookies <small>Needed for account and security features.</small></label><label><input type="checkbox" defaultChecked /> Optional analytics <small>Helps us improve the site.</small></label></div>}<div className="cookie-consent-actions"><button type="button" onClick={() => choose('necessary')}>Essential only</button><button type="button" onClick={() => setPreferencesOpen((current) => !current)}>{preferencesOpen ? 'Close settings' : 'Settings'}</button><button className="cookie-accept" type="button" onClick={() => choose('all')}>Accept all</button></div></aside>;
}
