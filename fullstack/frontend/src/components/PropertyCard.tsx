'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from './Icons';
import { Language, t } from '../data/translations';

export type PropertyPoster = { name: string; businessName?: string; photoUrl?: string; phone?: string; location?: string; role: 'Komisiyoneri' | 'Landlord' | 'Property Owner'; verified?: boolean; postedAt?: string; rating?: string };
export type PropertyPlaceholder = { id: string; title: string; type: string; location: string; price: string; priceNote: string; bedrooms: number; bathrooms: number; area: number; accent: string; image: string; images?: string[]; listed: string; availableFor?: 'rent' | 'sale' | 'both'; description?: string; poster?: PropertyPoster; sample?: boolean };
type PropertyCardProps = { language: Language; property: PropertyPlaceholder; favorite: boolean; onFavorite: () => void; onView: () => void };

export function PropertyCard({ language, property, favorite, onFavorite, onView }: PropertyCardProps) {
  const images = property.images?.length ? property.images : [property.image];
  const [activeImage, setActiveImage] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const changeImage = (direction: number) => setActiveImage((current) => (current + direction + images.length) % images.length);

  useEffect(() => {
    if (!isHovered || images.length < 2) return;
    const interval = window.setInterval(() => setActiveImage((current) => (current + 1) % images.length), 950);
    return () => window.clearInterval(interval);
  }, [isHovered, images.length]);

  const startHoverGallery = () => {
    setIsHovered(true);
    if (images.length > 1) setActiveImage(1);
  };

  return (
    <article className="property-card" onMouseEnter={startHoverGallery} onMouseLeave={() => setIsHovered(false)}>
      <div className="property-image">
        <div className="property-image-track" style={{ transform: `translateX(-${activeImage * 100}%)` }} aria-live="polite">{images.map((image, index) => <div className="property-image-slide" key={`${image}-${index}`}><Image src={image} alt={`${t(language, property.title)} ${t(language, 'property image')} ${index + 1}`} fill sizes="(max-width: 760px) 100vw, 33vw" className="property-image-art" /></div>)}</div>
        {images.length > 1 && <>
          <button className="property-gallery-arrow property-gallery-prev" type="button" onClick={() => changeImage(-1)} aria-label={t(language, 'Previous property image')}><Icon name="chevron" size={16} /></button>
          <button className="property-gallery-arrow property-gallery-next" type="button" onClick={() => changeImage(1)} aria-label={t(language, 'Next property image')}><Icon name="chevron" size={16} /></button>
          <div className="property-gallery-dots" aria-label={t(language, 'Property photos')}>{images.map((image, index) => <button key={`${image}-${index}`} className={index === activeImage ? 'is-active' : ''} type="button" onClick={() => setActiveImage(index)} aria-label={`${t(language, 'Show property image')} ${index + 1}`} />)}</div>
        </>}
        {!property.sample && <button className={`favorite-button ${favorite ? 'is-favorite' : ''}`} type="button" onClick={onFavorite} aria-label={favorite ? `${t(language, 'Remove property from favorites')}: ${t(language, property.title)}` : `${t(language, 'Save property')}: ${t(language, property.title)}`}><Icon name="heart" size={18} filled={favorite} /></button>}
        <span className={`verified-badge ${property.sample ? 'property-example-badge' : ''}`}>{property.sample ? t(language, 'Illustrative example') : property.poster?.verified ? <><Icon name="check" size={12} /> {t(language, 'Verified owner')}</> : t(language, 'Owner listing')}</span>
      </div>
      <div className="property-card-body">
        <div className="property-card-top"><div><span className="property-type">{t(language, property.type)}</span><h3>{t(language, property.title)}</h3><p><Icon name="pin" size={13} /> {t(language, property.location)}</p></div><span className="property-accent" style={{ background: property.accent }} aria-hidden="true" /></div>
        <div className="property-details"><span><strong>{property.bedrooms}</strong> {t(language, 'beds')}</span><span><strong>{property.bathrooms}</strong> {t(language, 'baths')}</span><span><strong>{property.area}</strong> m2</span></div>
        <div className="property-card-footer"><div><strong>{property.price} <small>{t(language, property.priceNote)}</small></strong><small className="property-listed">{t(language, property.listed)}</small></div><Link className="view-property-button" href={property.sample ? '#featured-example' : `/property/${encodeURIComponent(property.id)}`} onClick={(event) => { if (property.sample) event.preventDefault(); onView(); }}>{t(language, property.sample ? 'View example' : 'View property')} <Icon name="arrow" size={14} /></Link></div>
      </div>
    </article>
  );
}
