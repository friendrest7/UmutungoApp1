'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../../components/Icons';
import { Navbar } from '../../components/Navbar';
import { umutungoApi } from '../../lib/umutungoApi';
import { usePersistentLanguage } from '../../lib/language';
import { usePersistentTheme } from '../../lib/theme';

export default function MessagesPage() {
  const router = useRouter();
  const { darkMode, toggleTheme } = usePersistentTheme();
  const { language, changeLanguage } = usePersistentLanguage();
  const [listingId, setListingId] = useState('');
  const [propertyTitle, setPropertyTitle] = useState('Property conversation');
  const [ownerName, setOwnerName] = useState('Property owner');
  const [propertyImage, setPropertyImage] = useState('');
  const [propertyLocation, setPropertyLocation] = useState('');
  const [draft, setDraft] = useState('');
  const [sentMessage, setSentMessage] = useState('');
  const [sentTime, setSentTime] = useState('');
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setListingId(params.get('listingId') ?? '');
    const title = params.get('propertyTitle') ?? 'Property conversation';
    setPropertyTitle(title);
    setOwnerName(params.get('ownerName') ?? 'Property owner');
    setPropertyImage(params.get('propertyImage') || (title.toLowerCase().includes('bicycle') ? '/properties/other-demo-06.jpg' : '/properties/story-detail.jpg'));
    setPropertyLocation(params.get('propertyLocation') ?? '');
  }, []);

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !listingId || sending) return;
    setSending(true);
    setNotice('');
    try {
      const result = await umutungoApi('/api/v1/messages', { method: 'POST', body: JSON.stringify({ listing_id: listingId, body }) });
      if (!result) {
        setNotice('Sign in to send your message to the property owner.');
        return;
      }
      setSentMessage(body);
      setSentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setDraft('');
      setNotice('Message sent to the property owner.');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setNotice(message.includes('valid landlord recipient')
        ? 'This account owns the listing, so it cannot message itself. Open Account, log out, then sign in as a client or tenant to contact the owner.'
        : message || 'Your message could not be sent. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return <div className={`app app-realistic messages-shell${darkMode ? ' theme-dark' : ''}`}>
    <Navbar darkMode={darkMode} onToggleTheme={toggleTheme} language={language} onLanguageChange={changeLanguage} />
    <main className="owner-messages-page">
      <button className="owner-messages-back" type="button" onClick={() => router.back()}><Icon name="arrow" size={15} /> Back to property</button>
      <div className="owner-message-layout">
        <aside className="owner-message-property-card">
          {propertyImage ? <img className="owner-message-property-image" src={propertyImage} alt={propertyTitle} onError={(event) => { const fallback = propertyTitle.toLowerCase().includes('bicycle') ? '/properties/other-demo-06.jpg' : '/properties/story-detail.jpg'; if (event.currentTarget.getAttribute('src') !== fallback) event.currentTarget.src = fallback; else event.currentTarget.style.visibility = 'hidden'; }} /> : <div className="owner-message-property-placeholder"><Icon name="home" size={28} /></div>}
          <div className="owner-message-property-copy"><h2>{propertyTitle}</h2>{propertyLocation && <p><Icon name="pin" size={13} /> {propertyLocation}</p>}<div><Icon name="check" size={14} /> Use this chat to negotiate the price and agree on the details with the owner.</div></div>
        </aside>
        <section className="owner-message-card" aria-labelledby="owner-message-heading">
          <header className="owner-message-heading"><span className="owner-message-avatar"><Icon name="user" size={20} /></span><div><h2 id="owner-message-heading">{ownerName}</h2><p>Deal chat <i /> {propertyTitle}</p></div><span className="owner-message-header-mark"><Icon name="home" size={15} /></span></header>
          <div className="owner-message-thread" aria-live="polite">
            <div className="owner-message-date-divider"><span>PROPERTY DEAL</span></div>
            <div className="owner-message-context"><span className="owner-message-context-icon"><Icon name="bookPen" size={15} /></span><span><strong>Start the conversation</strong><small>Discuss the price, ask questions, and agree on the details.</small></span></div>
            {sentMessage && <div className="owner-message-bubble"><span>{sentMessage}</span><small>{sentTime} <Icon name="check" size={12} /><Icon name="check" size={12} /></small></div>}
            {!sentMessage && <p className="owner-message-empty">Your messages with {ownerName} will appear here.</p>}
          </div>
          <form className="owner-message-composer" onSubmit={sendMessage}>
            <div className="owner-message-compose-row"><div className="owner-message-compose-box"><textarea id="owner-message-draft" aria-label="Write a message" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Message ${ownerName}...`} rows={2} required /></div>
            <button className="owner-message-send" type="submit" aria-label="Send message" disabled={sending || !draft.trim() || !listingId}><Icon name="arrow" size={17} /></button></div>
            {notice && <p className="owner-message-notice" role="status">{notice}{notice.startsWith('Sign in') && <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('umutungo:request-sign-in', { detail: { role: 'Client', returnTo: `${window.location.pathname}${window.location.search}` } }))}>Sign in</button>}</p>}
          </form>
        </section>
      </div>
    </main>
  </div>;
}
