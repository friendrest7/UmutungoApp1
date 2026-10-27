'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from './Icons';
import { Language, t } from '../data/translations';
import { propertySlug, supportsSpatialPreview } from '../lib/listings';

export type PropertyPoster = { id?: string; name: string; businessName?: string; photoUrl?: string; phone?: string; location?: string; role: 'Komisiyoneri' | 'Landlord' | 'Property Owner'; verified?: boolean; postedAt?: string; rating?: string };
export type PropertyPlaceholder = { id: string; title: string; type: string; location: string; latitude?: number | null; longitude?: number | null; price: string; priceNote: string; bedrooms: number; bathrooms: number; parkingSpaces?: number; area: number; negotiable?: boolean; amenities?: string[]; tags?: string[]; accent: string; image: string; images?: string[]; photoCount?: number; listed: string; availableFor?: 'rent' | 'sale' | 'both' | 'book'; description?: string; poster?: PropertyPoster };
type PropertyCardProps = { language: Language; property: PropertyPlaceholder; favorite: boolean; onFavorite: () => void };

export function PropertyCard({ language, property, favorite, onFavorite }: PropertyCardProps) {
  const images = property.images?.length ? property.images : [property.image];
  const [activeImage, setActiveImage] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [imageFallbacks, setImageFallbacks] = useState<Record<number, string>>({});
  const [dialog, setDialog] = useState<'contact' | 'share' | null>(null);
  const [copied, setCopied] = useState(false);
  const detailHref = `/property/${propertySlug(property.title)}${supportsSpatialPreview(property.type) ? '?view=3d' : ''}`;
  const listingUrl = typeof window === 'undefined' ? detailHref : `${window.location.origin}${detailHref}`;
  const contactLabel = property.poster?.role === 'Komisiyoneri' ? t(language, 'Contact advertiser') : t(language, 'Contact owner');
  const type = property.type.toLowerCase();
  const residential = /house|home|apartment|residential|villa|room/.test(type);
  const vehicle = /vehicle|car|motorcycle|truck/.test(type);
  const land = /land|plot/.test(type);
  const messageHref = `/messages?${new URLSearchParams({ listingId: property.id, propertyTitle: property.title, ownerName: property.poster?.businessName || property.poster?.name || 'Property advertiser', propertyImage: property.image, propertyLocation: property.location }).toString()}`;
  useEffect(() => {
    setActiveImage(0);
    setImageFallbacks({});
  }, [property.id]);
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

  return <article className="property-card property-card-redesign" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
    <div className="property-image property-card-photo">
      <div className="property-image-track" style={{ transform: `translateX(-${activeImage * 100}%)` }} aria-live="polite">{images.map((image, index) => {
        const displayedImage = imageFallbacks[index] ?? image;
        return <div className="property-image-slide" key={`${image}-${index}`}><Image src={displayedImage} alt={`${t(language, property.title)} ${t(language, 'property image')} ${index + 1}`} fill sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 33vw" unoptimized={displayedImage.startsWith('http')} className="property-image-art" onError={() => setImageFallbacks((current) => ({ ...current, [index]: '/properties/listing-placeholder.svg' }))} /></div>;
      })}</div>
      <Link className="property-card-photo-link" href={`${detailHref}${detailHref.includes('?') ? '&' : '?'}gallery=1`} aria-label={`${t(language, 'Open photo gallery for')} ${property.title}`} />
      <div className="property-card-photo-labels">{property.poster?.verified && <span className="property-card-verified-badge"><Icon name="check" size={12} />{t(language, 'Verified')}</span>}<span className="property-category-badge">{t(language, property.type)}</span></div>
      <button className={`favorite-button ${favorite ? 'is-favorite' : ''}`} type="button" onClick={onFavorite} aria-pressed={favorite} aria-label={favorite ? `${t(language, 'Remove property from favorites')}: ${property.title}` : `${t(language, 'Save property')}: ${property.title}`}><Icon name="heart" size={18} filled={favorite} /></button>
    </div>
    <div className="property-card-body">
      <div className="property-card-title-row"><h3>{t(language, property.title)}</h3><span className={`property-availability-tag ${property.availableFor === 'rent' ? 'is-rent' : ''}`}>{property.availableFor === 'rent' ? t(language, 'For rent') : property.availableFor === 'both' ? t(language, 'For sale or rent') : property.availableFor === 'book' ? t(language, 'For booking') : t(language, 'For sale')}</span></div>
      <div className="property-card-location-row"><p><Icon name="pin" size={15} /> <span>{t(language, property.location || 'Location available on request')}</span></p></div>
      {(residential || land || property.parkingSpaces || (property.area > 0 && !vehicle)) && <div className="property-details property-card-features">{residential && property.bedrooms > 0 && <span><Icon name="home" size={15} /><strong>{property.bedrooms}</strong> {t(language, 'Beds')}</span>}{residential && property.bathrooms > 0 && <span><Icon name="building" size={15} /><strong>{property.bathrooms}</strong> {t(language, 'Baths')}</span>}{property.parkingSpaces ? <span><Icon name="car" size={15} /><strong>{property.parkingSpaces}</strong> {t(language, 'Parking')}</span> : null}{property.area > 0 && !vehicle && <span><Icon name="leaf" size={15} /><strong>{property.area.toLocaleString()}</strong> m² {t(language, land ? 'Land area' : 'Area')}</span>}</div>}
      <div className="property-card-footer property-card-redesign-footer"><strong className="property-card-price">{property.price}{property.priceNote && !/^\s*asking\s*$/i.test(property.priceNote) && <> <small>{t(language, property.priceNote)}</small></>}</strong><div className="property-card-actions"><Link className="view-property-button" href={detailHref}>{t(language, 'View details')}</Link><button className="property-card-contact" type="button" onClick={() => setDialog('contact')}>{contactLabel}</button><button className="property-card-share" type="button" onClick={() => void openShare()} aria-label={`${t(language, 'Share')} ${property.title}`}><Icon name="share" size={17} /></button></div></div>
    </div>
    {dialog && <div className="property-card-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null); }}><section className="property-card-dialog" role="dialog" aria-modal="true" aria-labelledby={`property-card-dialog-${property.id}`}><button className="property-card-dialog-close" type="button" onClick={() => setDialog(null)} aria-label={t(language, 'Close')}><Icon name="x" size={18} /></button><h3 id={`property-card-dialog-${property.id}`}>{dialog === 'contact' ? `${contactLabel} · ${property.poster?.businessName || property.poster?.name || t(language, 'Property advertiser')}` : t(language, 'Share this listing')}</h3>{dialog === 'contact' ? <div className="property-card-dialog-actions">{property.poster?.verified && property.poster.phone ? <><a href={`tel:${property.poster.phone}`}><Icon name="user" size={16} />{t(language, 'Call')} {property.poster.phone}</a><a href={`https://wa.me/${property.poster.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`${property.title} ${listingUrl}`)}`} target="_blank" rel="noreferrer"><Icon name="arrow" size={16} />WhatsApp</a></> : <p>{t(language, 'Phone and WhatsApp details are not publicly available for this advertiser.')}</p>}<Link href={messageHref} onClick={() => setDialog(null)}><Icon name="bookPen" size={16} />{t(language, 'Message on Umutungo')}</Link></div> : <div className="property-card-dialog-actions"><button type="button" onClick={() => void copyLink()}>{copied ? t(language, 'Link copied') : t(language, 'Copy link')}</button><a href={`https://wa.me/?text=${encodeURIComponent(`${property.title} ${listingUrl}`)}`} target="_blank" rel="noreferrer">WhatsApp</a><a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(listingUrl)}`} target="_blank" rel="noreferrer">Facebook</a><p>{t(language, 'For Instagram, TikTok, or Status, copy the link and paste it in your post.')}</p></div>}</section></div>}
    {copied && <span className="property-card-copy-confirmation" role="status">{t(language, 'Link copied to clipboard')}</span>}
  </article>;
}
