import { NextResponse } from 'next/server';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-oss-120b';
const categories = ['properties', 'houses', 'apartments', 'land', 'commercial', 'offices', 'hospitality', 'vehicles', 'car-parts', 'furniture', 'appliances', 'equipment', 'other'];
const priceRanges = ['Any price', '0–300,000', '300,000–500,000', '500,000–1,000,000', '1,000,000–10,000,000', '10,000,000+'];
const provinces = ['City of Kigali', 'Eastern Province', 'Northern Province', 'Southern Province', 'Western Province'];
const districts = ['Gasabo', 'Kicukiro', 'Nyarugenge', 'Bugesera', 'Gatsibo', 'Kayonza', 'Kirehe', 'Ngoma', 'Nyagatare', 'Ruhango', 'Musanze', 'Rubavu', 'Huye', 'Rusizi', 'Karongi'];
const sectors = ['Kacyiru', 'Kimihurura', 'Nyarutarama', 'Remera', 'Kibagabaga', 'Gacuriro', 'Kanombe', 'Gisozi', 'Kabeza', 'Kicukiro', 'Gikondo', 'Kimironko', 'Kinyinya', 'Jali', 'Nyamirambo', 'Kimisagara', 'Kigali'];

type SearchMessage = { role: 'user' | 'assistant'; content: string };
export type SearchPlan = {
  status: 'clarify' | 'search';
  reply: string;
  category: string;
  location: string;
  province: string;
  district: string;
  sector: string;
  intent: string;
  priceRange: string;
  minBedrooms: number;
};

function normalizeLocation(value: unknown, allowed: string[]) {
  if (typeof value !== 'string') return '';
  const input = value.trim();
  if (/^kigali$/i.test(input) && allowed === provinces) return 'City of Kigali';
  return allowed.find((place) => place.toLowerCase() === input.toLowerCase()) ?? '';
}

function fallbackPlan(messages: SearchMessage[]): SearchPlan {
  const userTurns = messages.filter((message) => message.role === 'user').map((message) => message.content);
  const conversation = userTurns.join(' ').toLowerCase();
  const categoryRules: Array<[string, RegExp]> = [
    ['car-parts', /\b(car part|spare part|auto part)s?\b/], ['apartments', /\b(apartment|flat|studio)s?\b/],
    ['houses', /\b(house|home|townhouse)s?\b/], ['land', /\b(land|plot)s?\b/],
    ['commercial', /\b(commercial|shop|retail|business space)s?\b/], ['offices', /\b(offices?|workspace)s?\b/],
    ['hospitality', /\b(hotel|lodge|guesthouse|guest room|stay)s?\b/], ['vehicles', /\b(car|vehicle|truck|suv|motorcycle)s?\b/],
    ['furniture', /\b(furniture|sofa|table|chair|bed frame)s?\b/], ['appliances', /\b(appliance|fridge|refrigerator|washing machine|oven)s?\b/],
    ['equipment', /\b(equipment|tool|excavator|drill)s?\b/], ['other', /\b(bicycle|bike|event venue|banquet)s?\b/],
  ];
  let category = 'properties';
  for (const turn of [...userTurns].reverse()) {
    const rule = categoryRules.find(([, pattern]) => pattern.test(turn.toLowerCase()));
    if (rule) { category = rule[0]; break; }
  }
  const locationCandidates = [...sectors, ...districts, ...provinces, 'Kigali', 'Musanze', 'Rubavu', 'Huye', 'Rwamagana', 'Nyamata', 'Kacyiru', 'Remera'];
  let location = '';
  for (const turn of [...userTurns].reverse()) {
    const match = locationCandidates.sort((a, b) => b.length - a.length).find((place) => turn.toLowerCase().includes(place.toLowerCase()));
    if (match) { location = match; break; }
  }
  const province = normalizeLocation(location, provinces);
  const district = normalizeLocation(location, districts);
  const sector = normalizeLocation(location, sectors);
  let intent = 'Buy or rent';
  for (const turn of [...userTurns].reverse()) {
    if (/\b(rent|rental|lease|hire|book|booking)\b/i.test(turn)) { intent = 'Rent'; break; }
    if (/\b(buy|purchase|sale|sell)\b/i.test(turn)) { intent = 'Buy'; break; }
  }
  let priceRange = 'Any price';
  const priceRules: Array<[string, RegExp]> = [
    [priceRanges[1], /\b(under|below|less than|up to)\s*(rwf\s*)?(300k|300,?000)\b|0\s*[-–]\s*300,?000/i],
    [priceRanges[2], /\b(300k\s*[-–]\s*500k|300,?000\s*[-–]\s*500,?000)\b/i],
    [priceRanges[3], /\b(500k\s*[-–]\s*1m|500,?000\s*[-–]\s*1,?000,?000)\b/i],
    [priceRanges[4], /\b(1m\s*[-–]\s*10m|1,?000,?000\s*[-–]\s*10,?000,?000)\b/i],
    [priceRanges[5], /\b(over|above|more than)\s*(rwf\s*)?(10m|10,?000,?000)\b|10,?000,?000\s*\+/i],
  ];
  for (const turn of [...userTurns].reverse()) {
    const match = priceRules.find(([, pattern]) => pattern.test(turn));
    if (match) { priceRange = match[0]; break; }
  }
  let minBedrooms = 0;
  for (const turn of [...userTurns].reverse()) {
    const bedroom = turn.match(/\b(\d+)\s*[- ]?bed(?:room)?s?\b/i) ?? turn.match(/\b(one|two|three|four)\s*[- ]?bed(?:room)?s?\b/i);
    if (bedroom) {
      const value = bedroom[1].toLowerCase();
      minBedrooms = Number(value) || ({ one: 1, two: 2, three: 3, four: 4 } as Record<string, number>)[value] || 0;
      break;
    }
  }
  const enoughToSearch = category !== 'properties' || Boolean(location) || intent !== 'Buy or rent' || priceRange !== 'Any price' || minBedrooms > 0;
  return {
    status: enoughToSearch ? 'search' : 'clarify',
    reply: enoughToSearch
      ? 'I’ll use the details from our conversation to find current listings. You can add or change an area, budget, or property detail.'
      : 'What kind of property are you looking for, and which area in Rwanda should I search?',
    category, location, province, district, sector, intent, priceRange, minBedrooms,
  };
}

function validMessage(value: unknown): value is SearchMessage {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string' && item.content.trim().length > 0;
}

export async function POST(request: Request) {
  let fallback: SearchPlan | null = null;
  try {
    const body = await request.json() as { messages?: unknown };
    const messages = Array.isArray(body.messages)
      ? body.messages.filter(validMessage).slice(-16).map((item) => ({ role: item.role, content: item.content.trim().slice(0, 1000) }))
      : [];
    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      return NextResponse.json({ error: 'Send a property request to continue the conversation.' }, { status: 400 });
    }
    fallback = fallbackPlan(messages);
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey === 'null') return NextResponse.json(fallback);

    const response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || DEFAULT_MODEL,
        messages: [
          { role: 'system', content: `You are Umutungo’s conversational property search assistant for Rwanda. Read the complete conversation, keep prior requirements unless the user changes them, and treat a new correction as replacing the earlier value for that requirement. This is a multi-turn conversation: ask one short clarifying question only when the property type or user intent is genuinely unclear; otherwise return status="search" so live listings can be loaded. Never create a keyword query. Return only JSON with status, reply, category, location, province, district, sector, intent, priceRange, minBedrooms. category must be one of ${categories.join(', ')}. location must be a Rwanda place stated or clearly implied, otherwise empty. province, district, sector must use a place name from the supplied allowed values or be empty. intent must be Buy, Rent, or Buy or rent. priceRange must be exactly one of ${priceRanges.join(', ')}. minBedrooms is an integer from 0 to 20, where 0 means no bedroom requirement. Use natural, concise wording in the user’s language. Do not claim that listings were found: the app will check live inventory after applying these criteria. Allowed provinces: ${provinces.join(', ')}. Districts: ${districts.join(', ')}. Known Kigali areas/sectors: ${sectors.join(', ')}.` },
          ...messages,
        ],
        temperature: 0.1,
        max_tokens: 400,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) return NextResponse.json(fallback);
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return NextResponse.json(fallback);
    const parsed = JSON.parse(raw) as Partial<SearchPlan>;
    const category = categories.includes(parsed.category ?? '') ? parsed.category! : fallback.category;
    const intent = ['Buy', 'Rent', 'Buy or rent'].includes(parsed.intent ?? '') ? parsed.intent! : fallback.intent;
    const plan: SearchPlan = {
      status: parsed.status === 'clarify' ? 'clarify' : 'search',
      reply: typeof parsed.reply === 'string' ? parsed.reply.trim().slice(0, 400) : fallback.reply,
      category,
      location: typeof parsed.location === 'string' ? parsed.location.trim().slice(0, 80) : fallback.location,
      province: normalizeLocation(parsed.province, provinces) || fallback.province,
      district: normalizeLocation(parsed.district, districts) || fallback.district,
      sector: normalizeLocation(parsed.sector, sectors) || fallback.sector,
      intent,
      priceRange: priceRanges.includes(parsed.priceRange ?? '') ? parsed.priceRange! : fallback.priceRange,
      minBedrooms: Number.isInteger(parsed.minBedrooms) && Number(parsed.minBedrooms) >= 0 && Number(parsed.minBedrooms) <= 20 ? Number(parsed.minBedrooms) : fallback.minBedrooms,
    };
    return NextResponse.json(plan);
  } catch {
    return fallback
      ? NextResponse.json(fallback)
      : NextResponse.json({ error: 'The property search assistant is unavailable right now.' }, { status: 500 });
  }
}
