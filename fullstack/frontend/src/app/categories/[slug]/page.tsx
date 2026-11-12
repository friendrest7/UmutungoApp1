import { CategoryExperience } from '../../../components/CategoryExperience';

type CategorySearchParams = { q?: string; location?: string; district?: string; sector?: string; intent?: string; priceRange?: string; minBedrooms?: string };

// Next.js 15+ passes params and searchParams as Promises; reading them synchronously
// yields undefined, which made every category page fall back to "All properties".
export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<CategorySearchParams> }) {
  const { slug } = await params;
  const query = await searchParams;
  return <CategoryExperience slug={slug} initialQuery={query.q ?? ''} initialLocation={query.location ?? ''} initialDistrict={query.district ?? ''} initialSector={query.sector ?? ''} initialIntent={query.intent ?? ''} initialPriceRange={query.priceRange ?? ''} initialMinBedrooms={Number(query.minBedrooms) || 0} />;
}
