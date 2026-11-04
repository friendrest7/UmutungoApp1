'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Icon } from './Icons';
import { Language, t } from '../data/translations';

type SearchMessage = { role: 'user' | 'assistant'; content: string };
type SearchPlan = { status: 'clarify' | 'search'; reply: string; category: string; location: string; province: string; district: string; sector: string; intent: string; priceRange: string; minBedrooms: number };

export function ConversationalPropertySearch({ language, compact = false }: { language: Language; compact?: boolean }) {
  const [messages, setMessages] = useState<SearchMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  const submitSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = prompt.trim();
    if (!content || isSending) return;
    const nextMessages = [...messages, { role: 'user' as const, content }];
    setMessages(nextMessages);
    setPrompt('');
    setError('');
    setIsSending(true);
    try {
      const response = await fetch('/api/property-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const result = await response.json() as SearchPlan | { error?: string };
      if (!response.ok || !('reply' in result)) throw new Error('error' in result ? result.error : undefined);
      const params = new URLSearchParams({ location: result.location, intent: result.intent, priceRange: result.priceRange });
      if (result.district) params.set('district', result.district);
      if (result.sector) params.set('sector', result.sector);
      if (result.province) params.set('province', result.province);
      if (result.minBedrooms > 0) params.set('minBedrooms', String(result.minBedrooms));
      window.location.assign(`/categories/${result.category}?${params.toString()}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The property search assistant is unavailable right now.');
    } finally {
      setIsSending(false);
    }
  };

  return <section className={`conversational-property-search ${compact ? 'is-compact' : ''} ${isOpen ? 'is-open' : ''}`} aria-label={t(language, 'AI property search')}>
    {!compact && <button className="conversational-search-trigger" type="button" aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)}>
      <span className="conversational-search-sparkle"><Icon name="sparkles" size={17} /></span>
      <span><strong>Find a property by chatting</strong><small>Tell us what you need in your own words.</small></span>
      <Icon name="arrow" size={16} />
    </button>}
    {(compact || isOpen) && <div className="conversational-search-body">
      {(!compact || messages.length > 0 || isSending || Boolean(error)) && <div className="conversational-search-messages" aria-live="polite">
        {!compact && !messages.length && <p>For example: “I’m looking for a two-bedroom home to rent in Kigali.”</p>}
        {messages.map((message, index) => <p className={`conversational-search-message ${message.role}`} key={`${message.role}-${index}`}>{message.content}</p>)}
        {isSending && <p className="conversational-search-status">Finding the right next step…</p>}
        {error && <p className="conversational-search-error" role="alert">{error}</p>}
      </div>}
      <form className="conversational-search-form" onSubmit={submitSearch}>
        <input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={compact ? 'Describe the properties you want and we’ll get them for you…' : 'Describe the property you need'} aria-label={compact ? 'Describe the properties you want and we’ll get them for you' : 'Describe the property you need'} disabled={isSending} />
        <button type="submit" aria-label={t(language, 'Send message')} disabled={isSending || !prompt.trim()}><Icon name="arrow" size={16} /></button>
      </form>
    </div>}
  </section>;
}
