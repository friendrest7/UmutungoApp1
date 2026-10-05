'use client';

import { useEffect, useState } from 'react';

type CookieChoice = 'all' | 'necessary';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    setVisible(!window.localStorage.getItem('umutungo-cookie-consent'));
  }, []);

  const choose = (choice: CookieChoice) => {
    window.localStorage.setItem('umutungo-cookie-consent', JSON.stringify({ choice, updatedAt: new Date().toISOString() }));
    setVisible(false);
  };

  if (!visible) return null;
  return <aside className="cookie-consent" aria-label="Cookie consent"><div><span className="cookie-consent-eyebrow">Privacy choices</span><h2>Keep your Umutungo experience clear.</h2><p>We use necessary storage for sign-in and saved activity. Optional analytics and personalization stay off until you allow them.</p></div>{preferencesOpen && <div className="cookie-preference-list"><label><input type="checkbox" checked readOnly /> Necessary storage <small>Required for account and security features.</small></label><label><input type="checkbox" defaultChecked /> Preferences and analytics <small>Helps us improve search and listing discovery.</small></label></div>}<div className="cookie-consent-actions"><button type="button" onClick={() => choose('necessary')}>Necessary only</button><button type="button" onClick={() => setPreferencesOpen((current) => !current)}>{preferencesOpen ? 'Close preferences' : 'Manage preferences'}</button><button className="cookie-accept" type="button" onClick={() => choose('all')}>Accept optional cookies</button></div></aside>;
}
