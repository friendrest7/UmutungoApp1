'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Icon } from './Icons';
import { Language, t } from '../data/translations';

type SearchMessage = { role: 'user' | 'assistant'; content: string };
type SearchPlan = { status: 'clarify' | 'search'; reply: string; category: string; query: string; location: string; intent: string; priceRange: string };

export function ConversationalPropertySearch({ language }: { language: Language }) {
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
      setMessages((current) => [...current, { role: 'assistant', content: result.reply }]);
      if (result.status === 'search') {
        const params = new URLSearchParams({ location: result.location, intent: result.intent, priceRange: result.priceRange });
        if (result.query) params.set('q', result.query);
        window.location.assign(`/categories/${result.category}?${params.toString()}`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The property search assistant is unavailable right now.');
    } finally {
      setIsSending(false);
    }
  };

  return <section className={`conversational-property-search ${isOpen ? 'is-open' : ''}`} aria-label={t(language, 'AI property search')}>
    <button className="conversational-search-trigger" type="button" aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)}>
      <span className="conversational-search-sparkle"><Icon name="sparkles" size={17} /></span>
      <span><strong>Find a property by chatting</strong><small>Tell us what you need in your own words.</small></span>
      <Icon name="arrow" size={16} />
    </button>
    {isOpen && <div className="conversational-search-body">
      <div className="conversational-search-messages" aria-live="polite">
        {!messages.length && <p>For example: “I’m looking for a two-bedroom home to rent in Kigali.”</p>}
        {messages.map((message, index) => <p className={`conversational-search-message ${message.role}`} key={`${message.role}-${index}`}>{message.content}</p>)}
        {isSending && <p className="conversational-search-status">Finding the right next step…</p>}
        {error && <p className="conversational-search-error" role="alert">{error}</p>}
      </div>
      <form className="conversational-search-form" onSubmit={submitSearch}>
        <input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Describe the property you need" aria-label="Describe the property you need" disabled={isSending} />
        <button type="submit" aria-label={t(language, 'Send message')} disabled={isSending || !prompt.trim()}><Icon name="arrow" size={16} /></button>
      </form>
    </div>}
  </section>;
}
