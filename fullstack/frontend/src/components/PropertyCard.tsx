'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from './Icons';
import { Language, t } from '../data/translations';
import { propertySlug, supportsSpatialPreview } from '../lib/listings';

export type PropertyPoster = { name: string; businessName?: string; photoUrl?: string; phone?: string; location?: string; role: 'Komisiyoneri' | 'Landlord' | 'Property Owner'; verified?: boolean; postedAt?: string; rating?: string };
export type PropertyPlaceholder = { id: string; title: string; type: string; location: string; latitude?: number | null; longitude?: number | null; price: string; priceNote: string; bedrooms: number; bathrooms: number; area: number; accent: string; image: string; images?: string[]; listed: string; availableFor?: 'rent' | 'sale' | 'both'; description?: string; poster?: PropertyPoster };
type PropertyCardProps = { language: Language; property: PropertyPlaceholder; favorite: boolean; onFavorite: () => void };

export function PropertyCard({ language, property, favorite, onFavorite }: PropertyCardProps) {
  const images = Array.from(new Set([...(property.images ?? []), property.image].filter(Boolean)));
  const isHouse = property.type.trim().toLowerCase() === 'house';
  const [activeImage, setActiveImage] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [imageFallbacks, setImageFallbacks] = useState<Record<number, string>>({});
  const changeImage = (direction: number) => setActiveImage((current) => (current + direction + images.length) % images.length);

  useEffect(() => {
    setActiveImage(0);
    setImageFallbacks({});
  }, [property.id]);

  useEffect(() => {
    if (!isHovered || images.length < 2) return;
    const interval = window.setInterval(() => setActiveImage((current) => (current + 1) % images.length), 2200);
    return () => window.clearInterval(interval);
  }, [isHovered, images.length]);

  const startHoverGallery = () => {
    setIsHovered(true);
    if (images.length > 1) setActiveImage(1);
  };

  return (
    <article className="property-card" onMouseEnter={startHoverGallery} onMouseLeave={() => setIsHovered(false)}>
      <div className="property-image">
        <div className="property-image-track" style={{ transform: `translateX(-${activeImage * 100}%)` }} aria-live="polite">{images.map((image, index) => {
          const displayedImage = imageFallbacks[index] ?? image;
          return <div className="property-image-slide" key={`${image}-${index}`}><Image src={displayedImage} alt={`${t(language, property.title)} ${t(language, 'property image')} ${index + 1}`} fill sizes="(max-width: 760px) 100vw, 33vw" unoptimized={displayedImage.startsWith('http')} className="property-image-art" onError={() => setImageFallbacks((current) => ({ ...current, [index]: '/properties/listing-placeholder.svg' }))} /></div>;
        })}</div>
        {images.length > 1 && <>
          <button className="property-gallery-arrow property-gallery-prev" type="button" onClick={() => changeImage(-1)} aria-label={t(language, 'Previous property image')}><Icon name="chevron" size={16} /></button>
          <button className="property-gallery-arrow property-gallery-next" type="button" onClick={() => changeImage(1)} aria-label={t(language, 'Next property image')}><Icon name="chevron" size={16} /></button>
          <div className="property-gallery-dots" aria-label={t(language, 'Property photos')}>{images.map((image, index) => <button key={`${image}-${index}`} className={index === activeImage ? 'is-active' : ''} type="button" onClick={() => setActiveImage(index)} aria-label={`${t(language, 'Show property image')} ${index + 1}`} />)}</div>
        </>}
        <button className={`favorite-button ${favorite ? 'is-favorite' : ''}`} type="button" onClick={onFavorite} aria-label={favorite ? `${t(language, 'Remove property from favorites')}: ${t(language, property.title)}` : `${t(language, 'Save property')}: ${t(language, property.title)}`}><Icon name="heart" size={18} filled={favorite} /></button>
        <span className="property-category-badge">{t(language, property.type)}</span>
      </div>
      <div className="property-card-body">
        <div className="property-card-location-row"><p><Icon name="pin" size={13} /> {t(language, property.location)}</p>{property.poster?.rating && <span className="property-card-rating"><span aria-hidden="true">★</span> {property.poster.rating}</span>}</div>
        <h3>{t(language, property.title)}</h3>
        <span className="property-availability-tag">{property.availableFor === 'rent' ? t(language, 'For rent') : property.availableFor === 'both' ? t(language, 'For sale or rent') : t(language, 'For sale')}</span>
        <div className="property-details">{isHouse && property.bedrooms > 0 && <span><strong>{property.bedrooms}</strong> {t(language, 'beds')}</span>}{isHouse && property.bathrooms > 0 && <span><strong>{property.bathrooms}</strong> {t(language, 'baths')}</span>}{property.area > 0 && <span><strong>{property.area}</strong> m²</span>}{!property.bedrooms && !property.bathrooms && !property.area && <span>{t(language, 'Property details available from owner')}</span>}</div>
        {property.poster && <div className="property-card-poster">{property.poster.photoUrl ? <Image src={property.poster.photoUrl} alt="" width={28} height={28} unoptimized /> : <span className="property-card-poster-initial">{property.poster.name.trim().charAt(0).toUpperCase()}</span>}<span>{t(language, 'Posted by')}: <strong>{property.poster.businessName || property.poster.name}</strong>{property.poster.verified && <small className="property-card-verified">{t(language, 'Verified')}</small>}</span></div>}
        <div className="property-card-footer"><div><strong>{property.price}{property.priceNote && !/^\s*asking\s*$/i.test(property.priceNote) && <> <small>{t(language, property.priceNote)}</small></>}</strong><small className="property-listed">{t(language, property.listed)}</small></div><div className="property-card-actions">{property.poster?.phone && <a className="property-card-call" href={`tel:${property.poster.phone}`} aria-label={`${t(language, 'Call')} ${property.poster.name}`}>{t(language, 'Call')}</a>}<Link className="view-property-button" href={`/property/${propertySlug(property.title)}${supportsSpatialPreview(property.type) ? '?view=3d' : ''}`}>{t(language, 'View property')}</Link></div></div>
      </div>
    </article>
  );
}
