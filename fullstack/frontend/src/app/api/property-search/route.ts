import { NextResponse } from 'next/server';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-oss-120b';
const categories = ['houses', 'apartments', 'land', 'commercial', 'offices', 'hospitality', 'vehicles', 'furniture', 'appliances', 'equipment', 'other'];

type SearchMessage = { role: 'user' | 'assistant'; content: string };
type SearchPlan = { status: 'clarify' | 'search'; reply: string; category: string; query: string; location: string; intent: string; priceRange: string };

function validMessage(value: unknown): value is SearchMessage {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string' && item.content.trim().length > 0;
}

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'null') return NextResponse.json({ error: 'Groq is not configured.' }, { status: 503 });

  try {
    const body = await request.json() as { messages?: unknown };
    const messages = Array.isArray(body.messages) ? body.messages.filter(validMessage).slice(-10).map((item) => ({ role: item.role, content: item.content.trim().slice(0, 1000) })) : [];
    if (!messages.length || messages[messages.length - 1].role !== 'user') return NextResponse.json({ error: 'Please describe what property you are looking for.' }, { status: 400 });

    const response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || DEFAULT_MODEL,
        messages: [
          { role: 'system', content: `You are Umutungo's friendly property search guide for Rwanda. Understand the whole conversation, ask at most one short useful follow-up if the request is unclear, and otherwise prepare the property search. Return only a JSON object with keys status, reply, category, query, location, intent, priceRange. status is clarify or search. category must be one of ${categories.join(', ')}. Use query only for meaningful property features or keywords; do not repeat category/location/transaction details there. location should be a Rwanda location stated or clearly implied by the user, otherwise empty. intent must be exactly Buy, Rent, or Buy or rent. priceRange must be exactly Any price, Under RWF 500,000, RWF 500,000 - 1,000,000, or Over RWF 1,000,000. Do not invent listings. Use the user's language in reply. Ask a follow-up only when necessary to understand the request; if the user gives a usable property request, status is search.` },
          ...messages,
        ],
        temperature: 0.2,
        max_tokens: 250,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) return NextResponse.json({ error: 'Groq could not understand that search right now.' }, { status: 502 });
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return NextResponse.json({ error: 'Groq returned an empty response.' }, { status: 502 });
    const parsed = JSON.parse(raw) as Partial<SearchPlan>;
    const plan: SearchPlan = {
      status: parsed.status === 'clarify' ? 'clarify' : 'search',
      reply: typeof parsed.reply === 'string' ? parsed.reply.slice(0, 400) : 'I’ve understood your search. Let me find matching properties.',
      category: categories.includes(parsed.category ?? '') ? parsed.category! : 'houses',
      query: typeof parsed.query === 'string' ? parsed.query.slice(0, 160) : '',
      location: typeof parsed.location === 'string' ? parsed.location.slice(0, 100) : '',
      intent: ['Buy', 'Rent', 'Buy or rent'].includes(parsed.intent ?? '') ? parsed.intent! : 'Buy or rent',
      priceRange: ['Any price', 'Under RWF 500,000', 'RWF 500,000 - 1,000,000', 'Over RWF 1,000,000'].includes(parsed.priceRange ?? '') ? parsed.priceRange! : 'Any price',
    };
    return NextResponse.json(plan);
  } catch {
    return NextResponse.json({ error: 'The property search assistant is unavailable right now.' }, { status: 500 });
  }
}
