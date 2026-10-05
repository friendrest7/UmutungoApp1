import { CategoryExperience } from '../../../components/CategoryExperience';

export default function CategoryPage({ params, searchParams }: { params: { slug: string }; searchParams: { q?: string; location?: string; district?: string; sector?: string; intent?: string; priceRange?: string } }) {
  return <CategoryExperience slug={params.slug} initialQuery={searchParams.q ?? ''} initialLocation={searchParams.location ?? ''} initialDistrict={searchParams.district ?? ''} initialSector={searchParams.sector ?? ''} initialIntent={searchParams.intent ?? ''} initialPriceRange={searchParams.priceRange ?? ''} />;
}
