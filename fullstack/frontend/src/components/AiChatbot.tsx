import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import { Icon } from './Icons';
import { Language, t } from '../data/translations';

type Message = { id: number; sender: 'assistant' | 'user'; text: string };

const searchableCategories: Array<[string, string[]]> = [
  ['car-parts', ['car parts', 'spare parts', 'auto parts', 'automotive parts', 'tire', 'tires', 'tyre', 'tyres', 'engine parts', 'ibice by imodoka']],
  ['vehicles', ['car', 'cars', 'vehicle', 'vehicles', 'truck', 'trucks', 'van', 'vans', 'bus', 'motorcycle', 'motorcycles', 'motorbike', 'automobile', 'suv', 'pickup', 'voiture', 'gari', 'imodoka']],
  ['apartments', ['apartment', 'apartments', 'flat', 'studio', 'apartima']],
  ['houses', ['house', 'houses', 'home', 'homes', 'inzu']],
  ['land', ['land', 'plot', 'plots', 'ubutaka']],
  ['commercial', ['commercial', 'shop', 'shops', 'business space']],
  ['offices', ['office', 'offices', 'workspace']],
  ['hospitality', ['hotel', 'hotels', 'lodge', 'lodges', 'guesthouse']],
  ['furniture', ['furniture', 'sofa', 'sofas', 'couch', 'couches', 'table', 'tables', 'chair', 'chairs', 'bed', 'beds', 'desk', 'wardrobe', 'cabinet', 'mattress']],
  ['appliances', ['appliance', 'appliances', 'refrigerator', 'refrigerators', 'refrigerateur', 'fridge', 'fridges', 'frigo', 'freezer', 'washing machine', 'oven', 'cooker', 'microwave', 'stove', 'firigo', 'jokofu']],
  ['equipment', ['equipment', 'tool', 'tools', 'excavator', 'drill', 'generator', 'machinery', 'laptop', 'computer']],
  ['other', ['bicycle', 'bicycles', 'bike', 'event venue', 'banquet']],
  ['properties', ['property', 'properties', 'real estate', 'listing', 'listings', 'place to live']],
];

function findListingSearch(text: string) {
  const normalized = text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const match = searchableCategories.flatMap(([category, terms]) => terms.map((term) => ({ category, term: term.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase() }))).find(({ term }) => ` ${normalized} `.includes(` ${term} `));
  if (!match) return null;
  const searchIntent = /\b(?:want|need|looking for|search(?:ing)? for|find|show|browse|buy|rent|hire|do you have|are there|je veux|je cherche|je voudrais|cherche|trouve|ndashaka|shaka|tafuta|natafuta|nataka|ninatafuta)\b/.test(normalized) || normalized.split(' ').length <= 2;
  if (!searchIntent) return null;
  const stopWords = new Set('i im want need looking for searching search find show me browse get have do you are there please a an the to with buy rent hire sale selling property properties listing listings real estate place to live je veux cherche voudrais une un le la les de du des dans avec trouver moi nataka ninatafuta tafuta kununua gukodesha kukodisha shaka ndashaka natafuta'.split(' '));
  const query = normalized.replace(match.term, ' ').split(/\s+/).filter((word) => word && !stopWords.has(word)).join(' ');
  const intent = /\b(?:rent|rental|lease|hire|gukodesha|kukodisha)\b/.test(normalized) ? 'Rent' : /\b(?:buy|purchase|sale|sell|kugura)\b/.test(normalized) ? 'Buy' : 'Buy or rent';
  return { category: match.category, query, intent };
}

export function AiChatbot({ language }: { language: Language }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ id: 1, sender: 'assistant', text: t(language, 'Hello! I can help you find a place in Rwanda. Ask me about renting, buying, locations, or property types.') }]);
  const chatbotRef = useRef<HTMLElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, originX: 0, originY: 0 });
  const dragPositionRef = useRef(dragPosition);
  const dragMovedRef = useRef(false);

  useEffect(() => {
    setMessages((current) => current.length === 1 && current[0].id === 1
      ? [{ id: 1, sender: 'assistant', text: t(language, 'Hello! I can help you find a place in Rwanda. Ask me about renting, buying, locations, or property types.') }]
      : current);
  }, [language]);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem('umutungo-ai-position') ?? 'null') as { x?: number; y?: number } | null;
      if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) setDragPosition({ x: stored.x as number, y: stored.y as number });
    } catch { /* use the default position */ }
  }, []);

  useEffect(() => {
    dragPositionRef.current = dragPosition;
  }, [dragPosition]);

  useEffect(() => {
    if (!isDragging) return;
    const move = (event: PointerEvent) => {
      const deltaX = event.clientX - dragStartRef.current.x;
      const deltaY = event.clientY - dragStartRef.current.y;
      if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) dragMovedRef.current = true;
      const next = { x: dragStartRef.current.originX + deltaX, y: dragStartRef.current.originY + deltaY };
      const bounded = { x: Math.max(-window.innerWidth + 70, Math.min(window.innerWidth - 70, next.x)), y: Math.max(-window.innerHeight + 100, Math.min(window.innerHeight - 100, next.y)) };
      dragPositionRef.current = bounded;
      setDragPosition(bounded);
    };
    const stop = () => {
      setIsDragging(false);
      window.localStorage.setItem('umutungo-ai-position', JSON.stringify(dragPositionRef.current));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); };
  }, [isDragging, dragPosition]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (open && chatbotRef.current && !chatbotRef.current.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || isSending) return;

    const userMessage: Message = { id: Date.now(), sender: 'user', text: trimmed };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setValue('');
    const listingSearch = findListingSearch(trimmed);
    if (listingSearch) {
      const categoryLabel = listingSearch.category === 'vehicles' ? 'vehicle' : listingSearch.category === 'car-parts' ? 'car part' : listingSearch.category;
      const replies: Record<Language, string> = {
        English: `I’m showing matching ${categoryLabel} listings now.`,
        French: `Voici les annonces correspondantes : ${categoryLabel}.`,
        Kinyarwanda: `Ndakwereka amatangazo ajyanye na ${categoryLabel} ubu.`,
        Swahili: `Ninakuonyesha matangazo yanayolingana ya ${categoryLabel} sasa.`,
      };
      setMessages([...nextMessages, { id: Date.now() + 1, sender: 'assistant', text: replies[language] }]);
      const params = new URLSearchParams({ intent: listingSearch.intent });
      if (listingSearch.query) params.set('q', listingSearch.query);
      window.location.assign(`/categories/${listingSearch.category}?${params.toString()}`);
      return;
    }
    setIsSending(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          messages: nextMessages.map((message) => ({ role: message.sender, content: message.text })),
        }),
      });
      const data = await response.json() as { message?: string; error?: string };
      if (!response.ok || !data.message) throw new Error(data.error || 'Chat unavailable');
      setMessages((current) => [...current, { id: Date.now() + 1, sender: 'assistant', text: data.message as string }]);
    } catch {
      const errors: Record<Language, string> = {
        English: 'I can’t connect to the property assistant right now. Please try again shortly.',
        French: 'Je ne peux pas joindre l’assistant immobilier pour le moment. Réessayez dans quelques instants.',
        Kinyarwanda: 'Ubu sinshobora kuguhuza n’umufasha wa Umutungo. Ongera ugerageze nyuma gato.',
        Swahili: 'Siwezi kuunganisha na msaidizi wa Umutungo kwa sasa. Tafadhali jaribu tena baadaye.',
      };
      setMessages((current) => [...current, { id: Date.now() + 1, sender: 'assistant', text: errors[language] }]);
    } finally {
      setIsSending(false);
    }
  };

  const startDragging = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    dragMovedRef.current = false;
    dragStartRef.current = { x: event.clientX, y: event.clientY, originX: dragPosition.x, originY: dragPosition.y };
    setIsDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  return <aside ref={chatbotRef} className={`ai-chatbot ${open ? 'is-open' : ''} ${isDragging ? 'is-dragging' : ''}`} style={{ transform: `translate3d(${dragPosition.x}px, ${dragPosition.y}px, 0)` }} aria-label={t(language, 'Umutungo help')}>
    {open && <div className="ai-chat-panel"><div className="ai-chat-header" onPointerDown={startDragging}><div><strong>{t(language, 'Umutungo Assistant')}</strong><small>Drag to move</small></div><button type="button" aria-label={t(language, 'Close chat')} onPointerDown={(event) => event.stopPropagation()} onClick={() => setOpen(false)}><Icon name="x" size={17} /></button></div><div className="ai-chat-messages" aria-live="polite">{messages.map((message) => <div className={`ai-chat-message ${message.sender}`} key={message.id}>{message.text}</div>)}{isSending && <div className="ai-chat-status" role="status">{t(language, 'Thinking...')}</div>}</div><form className="ai-chat-form" onSubmit={sendMessage}><input value={value} onChange={(event) => setValue(event.target.value)} placeholder={t(language, 'Ask Umutungo...')} aria-label={t(language, 'Ask Umutungo')} disabled={isSending} /><button type="submit" aria-label={t(language, 'Send message')} disabled={isSending || !value.trim()}><Icon name="arrow" size={15} /></button></form></div>}
    {!open && <button className="ai-chat-toggle" type="button" onPointerDown={startDragging} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => { if (dragMovedRef.current) { event.preventDefault(); dragMovedRef.current = false; return; } setOpen(true); }} aria-expanded={false} aria-label={t(language, 'Open chat')}><Icon name="sparkles" size={17} /><span>{t(language, 'Need help?')}</span></button>}
  </aside>;
}
