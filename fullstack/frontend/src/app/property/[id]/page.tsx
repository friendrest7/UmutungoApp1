'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import type { PropertyPlaceholder } from '../../../components/PropertyCard';
import { Icon, type IconName } from '../../../components/Icons';
import { InterfacePreferences } from '../../../components/InterfacePreferences';
import { Logo } from '../../../components/Logo';
import { PropertyViewer } from '../../../components/PropertyViewer';
import { publicUmutungoApi, umutungoApi } from '../../../lib/umutungoApi';
import { toProperty, type ApiListing as SharedApiListing } from '../../../lib/listings';
import { propertySlug, supportsSpatialPreview } from '../../../lib/listings';
import { isLocalDevelopmentHost, readLocalPropertyListings } from '../../../lib/localListings';
import { usePersistentTheme } from '../../../lib/theme';
import styles from './property.module.css';

type ApiListing = SharedApiListing & { id: string; title: string };

const CATEGORY_SLUGS: Record<string, { slug: string; label: string }> = {
  house: { slug: 'houses', label: 'Houses' },
  apartment: { slug: 'apartments', label: 'Apartments' },
  land: { slug: 'land', label: 'Land' },
  commercial: { slug: 'commercial', label: 'Commercial buildings' },
  office: { slug: 'offices', label: 'Offices' },
  hospitality: { slug: 'hospitality', label: 'Hotels and lodges' },
  vehicle: { slug: 'vehicles', label: 'Vehicles' },
  furniture: { slug: 'furniture', label: 'Furniture' },
  appliance: { slug: 'appliances', label: 'Appliances' },
  equipment: { slug: 'equipment', label: 'Equipment' },
  other: { slug: 'other', label: 'Other assets' },
};

const REPORT_REASONS = [
  { value: 'fraud', label: 'Looks like a scam or fraud' },
  { value: 'incorrect_information', label: 'Wrong price, photos or details' },
  { value: 'sold_unavailable', label: 'Already sold or rented' },
  { value: 'duplicate', label: 'Duplicate listing' },
  { value: 'offensive_content', label: 'Offensive content' },
  { value: 'other', label: 'Something else' },
];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tags used internally (e.g. test fixtures) must never be shown to visitors. */
const isPublicTag = (tag: string) => Boolean(tag.trim()) && !/^umutungo-|:/.test(tag.trim());
const sentenceCase = (text: string) => text ? text.charAt(0).toUpperCase() + text.slice(1) : text;

export default function PropertyDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { darkMode } = usePersistentTheme();
  const [property, setProperty] = useState<PropertyPlaceholder | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPlan, setShowPlan] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0].value);
  const [reportDetails, setReportDetails] = useState('');
  const [reportStatus, setReportStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [reportSending, setReportSending] = useState(false);

  useEffect(() => {
    let active = true;
    const openGallery = new URLSearchParams(window.location.search).get('gallery') === '1';
    const id = decodeURIComponent(params.id ?? '');
    const findLocal = () => isLocalDevelopmentHost() ? readLocalPropertyListings().find((item) => item.id === id || propertySlug(item.title) === id) : undefined;
    const show = (found: PropertyPlaceholder | undefined | null) => {
      if (!found) return;
      setProperty(found);
      if (openGallery) setGalleryIndex(0);
    };
    setLoading(true);
    setProperty(null);
    // Locally, listings saved in this browser come first; anything else (for
    // example a listing from the local backend) is loaded from the API below,
    // so "View details" works for every card.
    const local = findLocal();
    if (local) {
      show(local);
      setLoading(false);
      return () => { active = false; };
    }
    const listingRequest = UUID_PATTERN.test(id)
      ? publicUmutungoApi<ApiListing>(`/api/v1/listings/${encodeURIComponent(id)}`)
      : publicUmutungoApi<{ items: ApiListing[] }>('/api/v1/listings', { cache: 'no-store' }).then((result) => result?.items.find((item) => propertySlug(item.title) === id) ?? null);
    void listingRequest
      .then((result) => { if (active) show(result ? toProperty(result) : findLocal()); })
      .catch(() => { if (active) show(findLocal()); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [params.id]);

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push('/categories/properties');
  };

  if (loading && !property) {
    return <main className={styles.page} aria-busy="true" data-own-colors="">
      <div className={styles.skeleton} aria-hidden="true"><span /><div><i /><i /><i /></div></div>
    </main>;
  }
  if (!property) {
    return <main className={styles.page} data-own-colors="">
      <div className={styles.notFound}>
        <h1>Listing not found</h1>
        <p>This listing has been removed or is no longer available.</p>
        <Link className={styles.primaryButton} href="/categories/properties">Browse all listings <Icon name="arrow" size={15} /></Link>
      </div>
    </main>;
  }

  const images = (property.images?.length ? property.images : [property.image]).filter(Boolean);
  const typeKey = property.type.trim().toLowerCase();
  const category = CATEGORY_SLUGS[typeKey] ?? Object.values(CATEGORY_SLUGS).find((entry) => typeKey.includes(entry.slug.replace(/s$/, '')));
  const showType = typeKey !== 'other' && !['property', 'properties'].includes(typeKey);
  const isRent = property.availableFor === 'rent' || property.availableFor === 'book';
  const availability = property.availableFor === 'rent' ? 'For rent' : property.availableFor === 'both' ? 'For sale or rent' : property.availableFor === 'book' ? 'For booking' : 'For sale';
  const requestLabel = property.availableFor === 'rent' ? 'Request to rent' : property.availableFor === 'both' ? 'Request to buy or rent' : property.availableFor === 'book' ? 'Request to book' : 'Request to buy';
  const priceNote = property.priceNote && !/^\s*asking\s*$/i.test(property.priceNote) ? property.priceNote.trim() : '';
  const residential = /house|home|apartment|residential|villa|room|hospitality/.test(typeKey);
  const facts: Array<{ icon: IconName; value: string; label: string }> = [
    residential && property.bedrooms > 0 ? { icon: 'bed', value: String(property.bedrooms), label: property.bedrooms === 1 ? 'Bedroom' : 'Bedrooms' } : null,
    residential && property.bathrooms > 0 ? { icon: 'bath', value: String(property.bathrooms), label: property.bathrooms === 1 ? 'Bathroom' : 'Bathrooms' } : null,
    property.area > 0 ? { icon: 'area', value: `${property.area.toLocaleString()} m²`, label: typeKey.includes('land') ? 'Plot size' : 'Floor area' } : null,
    property.parkingSpaces ? { icon: 'car', value: String(property.parkingSpaces), label: 'Parking' } : null,
  ].filter((fact): fact is { icon: IconName; value: string; label: string } => fact !== null);
  const features = [...(property.amenities ?? []), ...(property.tags ?? [])].filter(isPublicTag);
  const description = sentenceCase(property.description?.trim() || 'The advertiser has not added a description yet. Send them a message to ask about the property.');
  const posterName = property.poster?.businessName || property.poster?.name || 'Umutungo advertiser';
  const mapDestination = property.latitude != null && property.longitude != null ? `${property.latitude},${property.longitude}` : `${property.location}, Rwanda`;
  const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapDestination)}`;
  const messageHref = `/messages?${new URLSearchParams({ listingId: property.id, propertyTitle: property.title, ownerName: posterName, propertyImage: property.image, propertyLocation: property.location }).toString()}`;
  const contactPhone = property.poster?.verified && property.poster.phone ? property.poster.phone : '';
  const details: Array<{ label: string; value: string }> = [
    showType ? { label: 'Type', value: property.type } : null,
    { label: 'Availability', value: availability },
    { label: 'Price', value: `${property.price}${priceNote ? ` ${priceNote}` : ''}` },
    property.negotiable ? { label: 'Negotiable', value: 'Yes' } : null,
    property.listed && !/^demo listing$/i.test(property.listed) ? { label: 'Listed', value: property.listed.replace(/^Listed (on )?/i, '') } : null,
    { label: 'Listing ID', value: property.id.slice(0, 8).toUpperCase() },
    ...(property.customDetails ?? []),
  ].filter((detail): detail is { label: string; value: string } => detail !== null);

  const openRequest = () => { setShowPlan(false); setRequestOpen(true); };
  const share = async () => {
    const url = window.location.href.split('?')[0];
    if (navigator.share) {
      try { await navigator.share({ title: property.title, url }); return; }
      catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url); setShareMessage('Link copied'); }
    catch { setShareMessage('Copy the link from your address bar'); }
    window.setTimeout(() => setShareMessage(''), 2600);
  };
  const submitReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setReportSending(true);
    setReportStatus(null);
    try {
      const result = await umutungoApi('/api/v1/reports', { method: 'POST', body: JSON.stringify({ listing_id: UUID_PATTERN.test(property.id) ? property.id : '', reason: reportReason, details: reportDetails.trim() || `Reported from listing page (${property.id})` }) });
      if (result) {
        setReportStatus({ tone: 'ok', text: 'Thank you. Your report was sent to the Umutungo team.' });
        setReportDetails('');
      } else {
        setReportStatus({ tone: 'error', text: 'Please sign in to send a report.' });
      }
    } catch {
      setReportStatus({ tone: 'error', text: 'The report could not be sent. Please sign in and try again.' });
    } finally {
      setReportSending(false);
    }
  };

  return (
    <>
      <div className={styles.shell} data-own-colors="">
        <header className={styles.topbar}>
          <div className={styles.topbarInner}>
            <button className={styles.backButton} type="button" onClick={goBack}><Icon name="arrow" size={15} /><span>Back</span></button>
            <Link href="/" className={styles.brand} aria-label="Umutungo home"><Logo darkMode={darkMode} /></Link>
            <InterfacePreferences className={styles.preferences} />
          </div>
        </header>

        <main className={styles.page}>
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            <ol>
              <li><Link href="/">Home</Link></li>
              <li><Link href={`/categories/${category?.slug ?? 'properties'}`}>{category?.label ?? 'All listings'}</Link></li>
              <li aria-current="page">{property.title}</li>
            </ol>
          </nav>

          <div className={styles.titleRow}>
            <div>
              <div className={styles.badges}>
                <span className={`${styles.badge} ${isRent ? styles.badgeRent : styles.badgeSale}`}>{availability}</span>
                {showType && <span className={styles.badge}>{property.type}</span>}
              </div>
              <h1 className={styles.title}>{property.title}</h1>
              <a className={styles.location} href={directionsHref} target="_blank" rel="noreferrer"><Icon name="pin" size={16} />{property.location || 'Location available on request'}</a>
            </div>
            <div className={styles.titleActions}>
              <button className={styles.ghostButton} type="button" onClick={() => void share()}><Icon name="share" size={16} />Share</button>
              {shareMessage && <span className={styles.toast} role="status">{shareMessage}</span>}
            </div>
          </div>

          <section className={styles.media} aria-label="Photos">
            {showPlan ? <div className={styles.planWrap}>
              <PropertyViewer language="English" property={property} initialMode="plan" embedded onClose={() => setShowPlan(false)} />
            </div> : <>
              <div className={`${styles.mosaic} ${styles[`mosaic${Math.min(images.length, 3)}`]}`}>
                {images.slice(0, 3).map((image, index) => <button key={`${image}-${index}`} type="button" className={styles.tile} onClick={() => setGalleryIndex(index)} aria-label={`Open photo ${index + 1} of ${images.length}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image} alt={index === 0 ? property.title : ''} onError={(event) => { event.currentTarget.src = '/properties/listing-placeholder.svg'; }} />
                </button>)}
              </div>
              <div className={styles.mediaActions}>
                {supportsSpatialPreview(property.type) && <button type="button" className={styles.mediaButton} onClick={() => setShowPlan(true)}><Icon name="home" size={15} />Floor plan</button>}
                {images.length > 1 && <button type="button" className={styles.mediaButton} onClick={() => setGalleryIndex(0)}><Icon name="camera" size={15} />All {images.length} photos</button>}
              </div>
            </>}
          </section>

          <div className={styles.layout}>
            <div className={styles.main}>
              {facts.length > 0 && <ul className={styles.facts} aria-label="Key facts">
                {facts.map((fact) => <li key={fact.label}><span className={styles.factIcon}><Icon name={fact.icon} size={20} /></span><span><strong>{fact.value}</strong><small>{fact.label}</small></span></li>)}
              </ul>}

              <section className={styles.section} aria-labelledby="about-heading">
                <h2 id="about-heading">About this {showType ? property.type.toLowerCase() : 'listing'}</h2>
                <p className={styles.description}>{description}</p>
              </section>

              {features.length > 0 && <section className={styles.section} aria-labelledby="features-heading">
                <h2 id="features-heading">Features</h2>
                <ul className={styles.features}>{features.map((feature) => <li key={feature}><Icon name="check" size={15} />{feature}</li>)}</ul>
              </section>}

              <section className={styles.section} aria-labelledby="details-heading">
                <h2 id="details-heading">Details</h2>
                <dl className={styles.details}>{details.map((detail) => <div key={`${detail.label}-${detail.value}`}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl>
              </section>

              <section className={styles.section} aria-labelledby="location-heading">
                <h2 id="location-heading">Location</h2>
                <div className={styles.locationCard}>
                  <span className={styles.locationIcon}><Icon name="pin" size={20} /></span>
                  <div><strong>{property.location || 'Location available on request'}</strong><small>The exact address is shared by the advertiser when you arrange a viewing.</small></div>
                  <a className={styles.secondaryButton} href={directionsHref} target="_blank" rel="noreferrer">Get directions <Icon name="externalLink" size={14} /></a>
                </div>
              </section>
            </div>

            <aside className={styles.aside} aria-label="Price and contact">
              <div className={styles.contactCard}>
                <p className={styles.price}>{property.price}{priceNote && <span> {priceNote}</span>}</p>
                {property.negotiable && <span className={styles.negotiable}>Price negotiable</span>}
                <div className={styles.contactActions}>
                  <button className={styles.primaryButton} type="button" onClick={openRequest}>{requestLabel} <Icon name="arrow" size={15} /></button>
                  <Link className={styles.secondaryButton} href={messageHref}><Icon name="bookPen" size={15} />Message advertiser</Link>
                  {contactPhone && <div className={styles.phoneRow}>
                    <a className={styles.secondaryButton} href={`tel:${contactPhone}`}><Icon name="phone" size={15} />Call</a>
                    <a className={styles.secondaryButton} href={`https://wa.me/${contactPhone.replace(/\D/g, '')}?text=${encodeURIComponent(property.title)}`} target="_blank" rel="noreferrer"><Icon name="whatsapp" size={15} />WhatsApp</a>
                  </div>}
                </div>

                <div className={styles.advertiser}>
                  <span className={styles.avatar} aria-hidden="true">{posterName.charAt(0).toUpperCase()}</span>
                  <div><small>Listed by</small><strong>{posterName}</strong>{property.poster?.role && <span>{property.poster.role}</span>}</div>
                </div>
              </div>

              <div className={styles.safety}>
                <p><Icon name="lock" size={15} /><span><strong>Stay safe.</strong> Visit the property and meet the advertiser before you pay anything.</span></p>
                {!reportOpen ? <button type="button" className={styles.linkButton} onClick={() => { setReportOpen(true); setReportStatus(null); }}>Report this listing</button> : <form className={styles.reportForm} onSubmit={submitReport}>
                  <label htmlFor="report-reason">What is wrong with this listing?</label>
                  <select id="report-reason" value={reportReason} onChange={(event) => setReportReason(event.target.value)} disabled={reportSending}>{REPORT_REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</select>
                  <label htmlFor="report-details">Details (optional)</label>
                  <textarea id="report-details" rows={3} maxLength={500} value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} disabled={reportSending} />
                  <div className={styles.reportActions}>
                    <button type="button" className={styles.linkButton} onClick={() => setReportOpen(false)}>Cancel</button>
                    <button type="submit" className={styles.smallButton} disabled={reportSending}>{reportSending ? 'Sending…' : 'Send report'}</button>
                  </div>
                  {reportStatus && <p className={reportStatus.tone === 'ok' ? styles.reportOk : styles.reportError} role="status">{reportStatus.text}</p>}
                </form>}
              </div>
            </aside>
          </div>
        </main>

        <div className={styles.mobileBar}>
          <p className={styles.mobilePrice}>{property.price}{priceNote && <span> {priceNote}</span>}</p>
          <button className={styles.primaryButton} type="button" onClick={openRequest}>{requestLabel}</button>
        </div>
      </div>

      {requestOpen && <PropertyViewer language="English" property={property} initialMode="photos" initialImageIndex={0} initialRequest onClose={() => setRequestOpen(false)} />}
      {galleryIndex !== null && <PropertyViewer language="English" property={property} initialMode="photos" initialImageIndex={galleryIndex} onClose={() => setGalleryIndex(null)} />}
    </>
  );
}
