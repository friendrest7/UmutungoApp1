import { NextResponse } from 'next/server';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-oss-120b';

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'null') return NextResponse.json({ error: 'Groq is not configured.' }, { status: 503 });

  try {
    const body = await request.json() as { tenantMessage?: string; listingTitle?: string; askingPrice?: string; conversation?: string };
    const tenantMessage = body.tenantMessage?.trim().slice(0, 1200);
    if (!tenantMessage) return NextResponse.json({ error: 'A tenant message is required.' }, { status: 400 });

    const prompt = `You are helping a Rwanda property owner reply to a tenant on Umutungo. Draft one warm, concise WhatsApp-style reply (2 to 4 sentences). Acknowledge the tenant, answer what you can, and be clear about the next step. Never promise a price reduction, availability, viewing, or approval unless the owner has explicitly agreed to it. If the tenant is negotiating, suggest a respectful counter-question or say the owner can consider the proposed amount. Do not mention AI.

Property: ${body.listingTitle?.trim().slice(0, 240) || 'the property'}
Current asking price: ${body.askingPrice?.trim().slice(0, 120) || 'not provided'}
Recent conversation: ${body.conversation?.trim().slice(-1800) || 'No earlier messages.'}
Tenant's latest message: ${tenantMessage}`;

    const response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || DEFAULT_MODEL,
        messages: [
          { role: 'system', content: 'You write natural, helpful property-owner replies for Rwanda.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.45,
        max_tokens: 220,
        reasoning_effort: 'low',
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) return NextResponse.json({ error: 'Groq could not draft a reply right now.' }, { status: 502 });
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) return NextResponse.json({ error: 'Groq returned an empty reply.' }, { status: 502 });
    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({ error: 'The reply service is unavailable right now.' }, { status: 500 });
  }
}
