import { NextRequest, NextResponse } from 'next/server';

const boundaryService = 'https://moegis.environment.gov.rw/server/rest/services/Hosted/Administrative_boundaries/FeatureServer';
const layerByLevel = { sector: 1, cell: 2, village: 3 } as const;

function quote(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const level = params.get('level') as keyof typeof layerByLevel;
  if (!level || !layerByLevel[level]) return NextResponse.json({ error: 'A valid location level is required.' }, { status: 400 });

  const province = params.get('province')?.trim();
  const district = params.get('district')?.trim();
  const sector = params.get('sector')?.trim();
  const cell = params.get('cell')?.trim();
  const filters = [province && `province=${quote(province)}`, district && `district=${quote(district)}`, sector && `sector=${quote(sector)}`, cell && `cell=${quote(cell)}`].filter(Boolean);
  const query = new URLSearchParams({ where: filters.length ? filters.join(' AND ') : '1=1', outFields: 'province,district,sector,cell,village', returnGeometry: 'false', orderByFields: level, f: 'json' });

  try {
    const response = await fetch(`${boundaryService}/${layerByLevel[level]}/query?${query.toString()}`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return NextResponse.json({ error: 'The national location directory is temporarily unavailable.' }, { status: 502 });
    const data = await response.json() as { features?: Array<{ attributes?: Record<string, string | null> }>; error?: { message?: string } };
    if (data.error) return NextResponse.json({ error: data.error.message ?? 'Location lookup failed.' }, { status: 502 });
    const values = Array.from(new Set((data.features ?? []).map((feature) => feature.attributes?.[level]).filter((value): value is string => Boolean(value))));
    return NextResponse.json({ level, values, source: 'Rwanda administrative boundaries (2022)' });
  } catch {
    return NextResponse.json({ error: 'The national location directory is temporarily unavailable.' }, { status: 502 });
  }
}
