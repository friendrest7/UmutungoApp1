import { ListingPaymentReturn } from '../../components/ListingPaymentReturn';

export default async function ListingPaymentPage({ searchParams }: { searchParams: Promise<{ status?: string; listing_id?: string }> }) {
  const { status, listing_id: listingId } = await searchParams;
  return <ListingPaymentReturn status={status ?? 'failed'} listingId={listingId ?? ''} />;
}
