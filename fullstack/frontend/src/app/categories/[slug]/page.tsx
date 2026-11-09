import { CategoryExperience } from '../../../components/CategoryExperience';

type CategorySearchParams = { q?: string; location?: string; district?: string; sector?: string; intent?: string; priceRange?: string; minBedrooms?: string };

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<CategorySearchParams> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  return <CategoryExperience slug={slug} initialQuery={query.q ?? ''} initialLocation={query.location ?? ''} initialDistrict={query.district ?? ''} initialSector={query.sector ?? ''} initialIntent={query.intent ?? ''} initialPriceRange={query.priceRange ?? ''} initialMinBedrooms={Number(query.minBedrooms) || 0} />;
}
