import { NextResponse } from 'next/server';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-oss-120b';
const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 1200;
const DEFAULT_BACKEND_URL = 'https://umutungoapp1-backend.onrender.com';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const systemPrompt = `You are the warm, conversational Umutungo property guide for Rwanda.
Talk like a helpful local property advisor, not like a form or a scripted chatbot. Acknowledge what the person just said, keep the conversation flowing, and ask one useful follow-up question at a time. Use natural language and vary your wording. If someone says they want a home near the U.S. Embassy, understand that they likely mean the Kacyiru area of Kigali and ask about budget, bedrooms, and whether they want furnished or unfurnished.
Help people explore homes, apartments, land, and commercial spaces; understand buying and renting; compare property details; learn about Kigali neighbourhoods; and list a property.
Use only information provided in the conversation, the database results supplied below, or general guidance. Treat database results as the source of truth for current listings and public professionals. Never invent live listings, availability, prices, or contact details. If no database result matches, say that no matching record was found and ask one useful refinement question.
Keep replies short but human, usually 2 to 4 sentences. Reply in the same language as the user when possible, including English, French, Kinyarwanda, or Swahili.`;

type DatabaseListing = {
  id: string;
  title: string;
  category: string;
  transaction_type: string;
  price: number;
  currency: string;
  province: string;
  district: string;
  sector: string;
  owner?: { name?: string; role?: string };
};

type DatabaseProfessional = {
  id: string;
  name: string;
  role: string;
  business_name: string;
  physical_address: string;
  verified: boolean;
  published_listings: number;
};

function backendUrl() {
  return (process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || DEFAULT_BACKEND_URL).trim().replace(/\/$/, '');
}

async function databaseContext(query: string) {
  const encodedQuery = encodeURIComponent(query.slice(0, 300));
  try {
    const [listingsResponse, directoryResponse] = await Promise.all([
      fetch(`${backendUrl()}/api/v1/listings?search=${encodedQuery}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) }),
      fetch(`${backendUrl()}/api/v1/directory?search=${encodedQuery}&limit=12`, { cache: 'no-store', signal: AbortSignal.timeout(8000) }),
    ]);
    const listingsBody = await listingsResponse.json().catch(() => ({})) as { items?: DatabaseListing[] };
    const directoryBody = await directoryResponse.json().catch(() => ({})) as { items?: DatabaseProfessional[] };
    return {
      listings: (listingsBody.items ?? []).slice(0, 12).map((item) => ({
        id: item.id, title: item.title, category: item.category, transaction_type: item.transaction_type,
        price: item.price, currency: item.currency, location: [item.district, item.sector, item.province].filter(Boolean).join(', '),
        owner: item.owner?.name || '', owner_role: item.owner?.role || '',
      })),
      professionals: (directoryBody.items ?? []).slice(0, 12).map((item) => ({
        id: item.id, name: item.name, role: item.role, business_name: item.business_name,
        physical_address: item.physical_address, verified: item.verified, published_listings: item.published_listings,
      })),
      available: listingsResponse.ok || directoryResponse.ok,
    };
  } catch {
    return { listings: [], professionals: [], available: false };
  }
}

function isValidMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  return (message.role === 'user' || message.role === 'assistant')
    && typeof message.content === 'string'
    && message.content.trim().length > 0;
}

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || DEFAULT_MODEL;

  if (!apiKey || apiKey === 'null') {
    return NextResponse.json({ error: 'Groq is not configured.' }, { status: 503 });
  }

  try {
    const body = await request.json() as { messages?: unknown };
    const messages = Array.isArray(body.messages)
      ? body.messages.filter(isValidMessage).slice(-MAX_MESSAGES).map((message) => ({
        role: message.role,
        content: message.content.trim().slice(0, MAX_MESSAGE_LENGTH),
      }))
      : [];

    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      return NextResponse.json({ error: 'Please send a message.' }, { status: 400 });
    }

    const lastUserMessage = messages[messages.length - 1].content;
    const context = await databaseContext(lastUserMessage);
    const databasePrompt = `Live Umutungo database context for the user's latest request (JSON; do not expose internal IDs unless useful):\n${JSON.stringify(context)}`;
    const response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'system', content: databasePrompt }, ...messages],
        temperature: 0.5,
        max_tokens: 450,
        reasoning_effort: 'low',
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Groq could not answer right now.' }, { status: 502 });
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const message = data.choices?.[0]?.message?.content?.trim();

    if (!message) {
      return NextResponse.json({ error: 'Groq returned an empty response.' }, { status: 502 });
    }

    return NextResponse.json({ message });
  } catch {
    return NextResponse.json({ error: 'The chat service is unavailable right now.' }, { status: 500 });
  }
}
