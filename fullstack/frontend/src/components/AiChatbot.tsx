import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import { Icon } from './Icons';
import { Language, t } from '../data/translations';

type Message = { id: number; sender: 'assistant' | 'user'; text: string };

export function AiChatbot({ language }: { language: Language }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ id: 1, sender: 'assistant', text: t(language, 'Hello! I can help you explore property in Rwanda. Never share a PIN or OTP, or send money based on a chat message. Use only the official Umutungo payment flow.') }]);
  const chatbotRef = useRef<HTMLElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, originX: 0, originY: 0 });
  const dragPositionRef = useRef(dragPosition);
  const dragMovedRef = useRef(false);

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
      setMessages((current) => [...current, { id: Date.now() + 1, sender: 'assistant', text: 'I can’t connect to the property assistant right now. For your safety, never share a PIN or OTP, or send money based on a chat message. Use only the official Umutungo payment flow.' }]);
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
