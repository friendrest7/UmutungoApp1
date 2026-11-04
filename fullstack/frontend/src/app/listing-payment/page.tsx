import { ListingPaymentReturn } from '../../components/ListingPaymentReturn';

export default async function ListingPaymentPage({ searchParams }: { searchParams: Promise<{ status?: string; listing_id?: string; tx_ref?: string; transaction_id?: string }> }) {
  const { status, listing_id: listingId, tx_ref: txRef, transaction_id: transactionId } = await searchParams;
  return <ListingPaymentReturn status={status ?? 'failed'} listingId={listingId ?? ''} txRef={txRef ?? ''} transactionId={transactionId ?? ''} />;
}
