'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from './Icons';
import { Language, t } from '../data/translations';
import styles from './PropertyCard.module.css';

export type PropertyPoster = { id?: string; name: string; businessName?: string; photoUrl?: string; phone?: string; location?: string; role: 'Komisiyoneri' | 'Landlord' | 'Property Owner'; verified?: boolean; postedAt?: string; rating?: string };
export type PropertyPlaceholder = { id: string; title: string; type: string; location: string; latitude?: number | null; longitude?: number | null; price: string; priceNote: string; bedrooms: number; bathrooms: number; parkingSpaces?: number; area: number; negotiable?: boolean; amenities?: string[]; tags?: string[]; customDetails?: Array<{ label: string; value: string }>; accent: string; image: string; images?: string[]; photoCount?: number; listed: string; availableFor?: 'rent' | 'sale' | 'both' | 'book'; description?: string; poster?: PropertyPoster; featured?: boolean };
type PropertyCardProps = { language: Language; property: PropertyPlaceholder; favorite: boolean; onFavorite: () => void };

const PLACEHOLDER_IMAGE = '/properties/listing-placeholder.svg';

function availabilityLabel(availableFor: PropertyPlaceholder['availableFor']) {
  if (availableFor === 'rent') return 'For rent';
  if (availableFor === 'both') return 'For sale or rent';
  if (availableFor === 'book') return 'For booking';
  return 'For sale';
}

function cardCategoryFor(property: PropertyPlaceholder) {
  const type = property.type.toLowerCase();
  if (!['property', 'properties', 'asset', 'assets'].includes(type)) return property.type;
  const title = property.title.toLowerCase();
  if (/refrigerator|fridge|washer|washing machine|appliance|kitchen appliance/.test(title)) return 'Appliance';
  if (/furniture|sofa|couch|dining set|bedroom set/.test(title)) return 'Furniture';
  if (/vehicle|car|sedan|suv|bicycle|bike|motorcycle|truck/.test(title)) return 'Vehicle';
  if (/guest room|guest stay|lodge|hotel|short stay/.test(title)) return 'Hospitality';
  if (/apartment|flat|studio/.test(title)) return 'Apartment';
  if (/office/.test(title)) return 'Office';
  if (/house|home|villa|bungalow/.test(title)) return 'House';
  if (/land|plot/.test(title)) return 'Land';
  if (/shop|warehouse|commercial|retail/.test(title)) return 'Commercial';
  if (/tool|equipment|machine|generator/.test(title)) return 'Equipment';
  return '';
}

export function PropertyCard({ language, property, favorite, onFavorite }: PropertyCardProps) {
  const images = property.images?.length ? property.images : [property.image];
  const [activeImage, setActiveImage] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [imageFallbacks, setImageFallbacks] = useState<Record<number, string>>({});
  const [dialog, setDialog] = useState<'contact' | 'share' | null>(null);
  const [copied, setCopied] = useState(false);
  const detailHref = `/property/${encodeURIComponent(property.id)}`;
  const listingUrl = typeof window === 'undefined' ? detailHref : `${window.location.origin}${detailHref}`;
  const posterName = property.poster?.businessName || property.poster?.name || '';
  const contactLabel = property.poster?.role === 'Komisiyoneri' ? t(language, 'Contact advertiser') : t(language, 'Contact owner');
  const type = property.type.toLowerCase();
  const residential = /house|home|apartment|residential|villa|room/.test(type);
  const vehicle = /vehicle|car|motorcycle|truck/.test(type);
  const land = /land|plot/.test(type);
  const isRent = property.availableFor === 'rent' || property.availableFor === 'book';
  const realPhotos = images.filter((image) => image && !image.endsWith('listing-placeholder.svg')).length;
  const photoCount = Math.max(property.photoCount ?? 0, realPhotos);
  // Some sources bake the period into the price ("RWF 775,000 / month"); show it as the note instead.
  const embeddedPeriod = property.price.match(/^(.*?)\s*(\/\s*[A-Za-z ]+)$/);
  const priceValue = embeddedPeriod ? embeddedPeriod[1] : property.price;
  const rawNote = property.priceNote || embeddedPeriod?.[2] || '';
  const priceNote = rawNote && !/^\s*asking\s*$/i.test(rawNote) ? rawNote : '';
  const messageHref = `/messages?${new URLSearchParams({ listingId: property.id, propertyTitle: property.title, ownerName: posterName || 'Property advertiser', propertyImage: property.image, propertyLocation: property.location }).toString()}`;
  const mapDestination = property.latitude != null && property.longitude != null ? `${property.latitude},${property.longitude}` : `${property.location}, Rwanda`;
  const directionsHref = `https://www.google.com/maps/dir/?api=1&origin=Current%20Location&destination=${encodeURIComponent(mapDestination)}&travelmode=driving`;
  const categoryLabel = cardCategoryFor(property);
  const facts = [
    residential && property.bedrooms > 0 ? { icon: 'bed' as const, value: String(property.bedrooms), label: property.bedrooms === 1 ? 'Bed' : 'Beds' } : null,
    residential && property.bathrooms > 0 ? { icon: 'bath' as const, value: String(property.bathrooms), label: property.bathrooms === 1 ? 'Bath' : 'Baths' } : null,
    property.parkingSpaces ? { icon: 'car' as const, value: String(property.parkingSpaces), label: 'Parking' } : null,
    property.area > 0 && !vehicle ? { icon: 'area' as const, value: `${property.area.toLocaleString()} m²`, label: land ? 'Land' : 'Area' } : null,
  ].filter((fact): fact is NonNullable<typeof fact> => fact !== null);

  useEffect(() => { setActiveImage(0); setImageFallbacks({}); }, [property.id]);
  useEffect(() => {
    if (!isHovered || images.length < 2) return;
    const timer = window.setInterval(() => setActiveImage((current) => (current + 1) % images.length), 2600);
    return () => window.clearInterval(timer);
  }, [isHovered, images.length]);
  useEffect(() => {
    if (!dialog) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setDialog(null); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [dialog]);

  const openShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: property.title, text: property.title, url: listingUrl }); return; }
      catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return; }
    }
    setDialog('share');
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(listingUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2600);
    } catch { setDialog('share'); }
  };

  return <>
    {/* data-own-colors opts the card out of the site-wide text colour overrides in globals.css. */}
    <article className={styles.card} data-own-colors="" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <div className={styles.media}>
        <div className={styles.track} style={{ transform: `translateX(-${activeImage * 100}%)` }}>{images.map((image, index) => {
          const displayedImage = imageFallbacks[index] ?? (image || PLACEHOLDER_IMAGE);
          return <div className={styles.slide} key={`${image}-${index}`}><Image src={displayedImage} alt={index === 0 ? t(language, property.title) : ''} fill sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 25vw" unoptimized={displayedImage.startsWith('http')} className={styles.image} onError={() => setImageFallbacks((current) => ({ ...current, [index]: PLACEHOLDER_IMAGE }))} /></div>;
        })}</div>
        <div className={styles.mediaShade} aria-hidden="true" />
        <div className={styles.badges}>
          <span className={`${styles.badge} ${isRent ? styles.badgeRent : styles.badgeSale}`}>{t(language, availabilityLabel(property.availableFor))}</span>
          {property.featured && <span className={`${styles.badge} ${styles.badgeFeatured}`} title={t(language, 'Featured listings are promoted by the advertiser.')}>{t(language, 'Featured')}</span>}
        </div>
        <button className={`${styles.save} ${favorite ? styles.saveActive : ''}`} type="button" onClick={onFavorite} aria-pressed={favorite} aria-label={favorite ? `${t(language, 'Remove property from favorites')}: ${property.title}` : `${t(language, 'Save property')}: ${property.title}`}><Icon name="heart" size={18} filled={favorite} /></button>
        <div className={styles.mediaFoot}>
          {categoryLabel ? <span className={styles.category}>{t(language, categoryLabel)}</span> : <span />}
          {photoCount > 1 && <Link className={styles.photoCount} href={`${detailHref}?gallery=1`} aria-label={`${t(language, 'Open photo gallery for')} ${property.title} (${photoCount})`}><Icon name="camera" size={13} />{photoCount}</Link>}
        </div>
      </div>

      <div className={styles.body}>
        <p className={styles.price}>{priceValue}{priceNote && <span> {t(language, priceNote)}</span>}{property.negotiable && <em>{t(language, 'Negotiable')}</em>}</p>
        <h3 className={styles.title}><Link className={styles.titleLink} href={detailHref}>{t(language, property.title)}</Link></h3>
        <a className={styles.location} href={directionsHref} target="_blank" rel="noreferrer" title={t(language, 'View route and estimated travel time')}><Icon name="pin" size={14} /><span>{t(language, property.location || 'Location available on request')}</span></a>
        {facts.length > 0 && <ul className={styles.facts} aria-label={t(language, 'Key facts')}>{facts.map((fact) => <li key={fact.label}><Icon name={fact.icon} size={15} /><strong>{fact.value}</strong><span>{t(language, fact.label)}</span></li>)}</ul>}

        <div className={styles.footer}>
          {property.poster && <div className={styles.poster}>
            <span className={styles.posterAvatar} aria-hidden="true">{(posterName || property.poster.role).charAt(0).toUpperCase()}</span>
            <span className={styles.posterText}>
              <strong>{posterName || t(language, property.poster.role)}</strong>
              <small><span>{t(language, property.poster.role)}</span>{property.poster.verified && <span className={styles.verified} title={t(language, 'This advertiser confirmed their phone number with a one-time code.')}><Icon name="check" size={11} />{t(language, 'Phone verified')}</span>}</small>
            </span>
          </div>}
          <div className={styles.actions}>
            <button className={styles.contact} type="button" onClick={() => setDialog('contact')} aria-label={`${contactLabel}: ${property.title}`}><Icon name="phone" size={15} />{contactLabel}</button>
            <button className={styles.iconButton} type="button" onClick={() => void openShare()} aria-label={`${t(language, 'Share')} ${property.title}`}><Icon name="share" size={16} /></button>
          </div>
        </div>
      </div>
    </article>

    {dialog && <div className="property-card-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null); }}><section className="property-card-dialog" role="dialog" aria-modal="true" aria-labelledby={`property-card-dialog-${property.id}`}><button className="property-card-dialog-close" type="button" onClick={() => setDialog(null)} aria-label={t(language, 'Close')}><Icon name="x" size={18} /></button><h3 id={`property-card-dialog-${property.id}`}>{dialog === 'contact' ? `${contactLabel} · ${posterName || t(language, 'Property advertiser')}` : t(language, 'Share this listing')}</h3>{dialog === 'contact' ? <div className="property-card-dialog-actions">{property.poster?.verified && property.poster.phone ? <><a href={`tel:${property.poster.phone}`}><Icon name="user" size={16} />{t(language, 'Call')} {property.poster.phone}</a><a href={`https://wa.me/${property.poster.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`${property.title} ${listingUrl}`)}`} target="_blank" rel="noreferrer"><Icon name="whatsapp" size={16} />{t(language, 'WhatsApp')}</a></> : <p>{t(language, 'Phone and WhatsApp details are not publicly available for this advertiser.')}</p>}<Link href={messageHref} onClick={() => setDialog(null)}><Icon name="bookPen" size={16} />{t(language, 'Message on Umutungo')}</Link></div> : <div className="property-card-dialog-actions"><button type="button" onClick={() => void copyLink()}>{copied ? t(language, 'Link copied') : t(language, 'Copy link')}</button><a href={`https://wa.me/?text=${encodeURIComponent(`${property.title} ${listingUrl}`)}`} target="_blank" rel="noreferrer"><Icon name="whatsapp" size={16} />{t(language, 'WhatsApp')}</a><a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(listingUrl)}`} target="_blank" rel="noreferrer">{t(language, 'Facebook')}</a><p>{t(language, 'For Instagram, TikTok, or Status, copy the link and paste it in your post.')}</p></div>}</section></div>}
    {copied && <span className="property-card-copy-confirmation" role="status">{t(language, 'Link copied to clipboard')}</span>}
  </>;
}
