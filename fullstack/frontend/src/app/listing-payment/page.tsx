import { ListingPaymentReturn } from '../../components/ListingPaymentReturn';

export default async function ListingPaymentPage({ searchParams }: { searchParams: Promise<{ status?: string; listing_id?: string; purchase_id?: string; package_key?: string; tx_ref?: string; transaction_id?: string; paid_draft?: string }> }) {
  const { status, listing_id: listingId, purchase_id: purchaseId, package_key: packageKey, tx_ref: txRef, transaction_id: transactionId, paid_draft: paidDraft } = await searchParams;
  return <ListingPaymentReturn status={status ?? 'failed'} listingId={listingId ?? ''} purchaseId={purchaseId ?? ''} packageKey={packageKey ?? ''} txRef={txRef ?? ''} transactionId={transactionId ?? ''} paidDraft={paidDraft === '1'} />;
}
