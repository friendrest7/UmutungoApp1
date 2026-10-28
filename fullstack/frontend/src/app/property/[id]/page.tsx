'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { PropertyPlaceholder } from '../../../components/PropertyCard';
import { Icon } from '../../../components/Icons';
import { InterfacePreferences } from '../../../components/InterfacePreferences';
import { PropertyViewer } from '../../../components/PropertyViewer';
import { publicUmutungoApi } from '../../../lib/umutungoApi';
import { listedOn, toProperty, type ApiListing as SharedApiListing } from '../../../lib/listings';
import { propertySlug, supportsSpatialPreview } from '../../../lib/listings';
import { isLocalDevelopmentHost, readLocalPropertyListings } from '../../../lib/localListings';

type ApiListing = {
  id: string;
  category: string;
  title: string;
  description?: string;
  price: number;
  currency?: string;
  province?: string;
  district?: string;
  sector?: string;
  transaction_type?: string;
  created_at?: string;
  owner?: {
    name?: string;
    role?: string;
    business_name?: string;
    photo_url?: string;
    phone?: string;
    verified?: boolean;
  };
  media?: Array<{ url: string }>;
};

function fromApi(item: ApiListing): PropertyPlaceholder {
  const isRent = item.transaction_type === 'rent_out' || item.transaction_type === 'rent';
  const isDemoExcavator = item.category.toLowerCase().includes('equipment')
    && item.title.toLowerCase().includes('excavator');
  const listingImages = item.media?.map((media) => media.url).filter((url) => (
    !isDemoExcavator
    || !/\/properties\/equipment-(?:0[1-5]|demo-06)\.jpg(?:$|\?)/i.test(url)
  ));
  const type = item.category.toLowerCase().includes('land')
    ? 'Land'
    : item.category.toLowerCase().includes('vehicle')
      ? 'Vehicle'
      : item.category;

  return {
    id: item.id,
    title: item.title,
    type,
    location: [item.sector, item.district, item.province].filter(Boolean).join(' - '),
    price: `${item.currency ?? 'RWF'} ${Number(item.price).toLocaleString()}`,
    priceNote: isRent ? '/ month' : '',
    bedrooms: 0,
    bathrooms: 0,
    area: 0,
    accent: '#087d3d',
    image: listingImages?.[0] ?? '/properties/house-01.jpg',
    images: listingImages,
    listed: item.created_at ? `Listed ${new Date(item.created_at).toLocaleDateString()}` : 'Listed recently',
    description: item.description,
    poster: {
      name: item.owner?.name ?? 'Verified property poster',
      businessName: item.owner?.business_name,
      photoUrl: item.owner?.photo_url,
      phone: item.owner?.phone,
      role: item.owner?.role === 'komisiyoneri'
        ? 'Komisiyoneri'
        : item.owner?.role === 'property_owner'
          ? 'Property Owner'
          : 'Landlord',
      verified: item.owner?.verified,
      postedAt: item.created_at ? new Date(item.created_at).toLocaleDateString() : undefined,
    },
  };
}

export default function PropertyDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [property, setProperty] = useState<PropertyPlaceholder | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewerMode, setViewerMode] = useState<'photos' | 'tour' | 'plan' | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [requestOpen, setRequestOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [tourSatisfaction, setTourSatisfaction] = useState<'yes' | 'no' | null>(null);
  const [directionsMapUrl, setDirectionsMapUrl] = useState('');
  const supports3DView = supportsSpatialPreview(property?.type ?? '');

  useEffect(() => {
    const open3d = new URLSearchParams(window.location.search).get('view') === '3d';
    const openGallery = new URLSearchParams(window.location.search).get('gallery') === '1';
    const id = decodeURIComponent(params.id ?? '');
    const isListingId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    setProperty(null);
    if (isLocalDevelopmentHost()) {
      const localProperty = readLocalPropertyListings().find((item) => item.id === id || propertySlug(item.title) === id);
      if (localProperty) {
        setProperty(localProperty);
        if (open3d && supportsSpatialPreview(localProperty.type)) setViewerMode('tour');
        if (openGallery) setGalleryOpen(true);
      }
      setLoading(false);
      return;
    }
    const listingRequest = isListingId
      ? publicUmutungoApi<ApiListing>(`/api/v1/listings/${encodeURIComponent(id)}`)
      : publicUmutungoApi<{ items: ApiListing[] }>('/api/v1/listings', { cache: 'no-store' }).then((result) => result?.items.find((item) => propertySlug(item.title) === id) ?? null);
    void listingRequest
      .then((result) => {
        if (result) {
          const mappedProperty = toProperty(result as SharedApiListing);
          setProperty(mappedProperty);
          if (open3d && supportsSpatialPreview(mappedProperty.type)) setViewerMode('tour');
          if (openGallery) setGalleryOpen(true);
          return;
        }
        const localProperty = isLocalDevelopmentHost() ? readLocalPropertyListings().find((item) => item.id === id || propertySlug(item.title) === id) : undefined;
        if (localProperty) {
          setProperty(localProperty);
          if (open3d && supportsSpatialPreview(localProperty.type)) setViewerMode('tour');
          if (openGallery) setGalleryOpen(true);
        }
      })
      .catch(() => {
        const localProperty = isLocalDevelopmentHost() ? readLocalPropertyListings().find((item) => item.id === id || propertySlug(item.title) === id) : undefined;
        if (localProperty) {
          setProperty(localProperty);
          if (open3d && supportsSpatialPreview(localProperty.type)) setViewerMode('tour');
          if (openGallery) setGalleryOpen(true);
        }
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading && !property) return <main className="property-detail-page property-detail-loading" aria-busy="true"><div className="property-detail-skeleton" aria-hidden="true"><span /><div><i /><i /><i /></div><section><i /><i /><i /><i /></section></div></main>;
  if (!property) {
    return (
      <main className="property-detail-loading">
        <h1>Property not found</h1>
        <p>This listing is no longer available.</p>
        <button type="button" onClick={() => router.back()}>Go back</button>
      </main>
    );
  }

  const openDirectionsFromCurrentLocation = () => {
    const destination = property.location || property.title;
    const showMap = (origin?: string) => {
      const query = new URLSearchParams({ output: 'embed', daddr: destination });
      if (origin) query.set('saddr', origin);
      setDirectionsMapUrl(`https://www.google.com/maps?${query.toString()}`);
    };
    if (!navigator.geolocation) { showMap(); return; }
    navigator.geolocation.getCurrentPosition(({ coords }) => showMap(`${coords.latitude},${coords.longitude}`), () => showMap(), { enableHighAccuracy: true, timeout: 8000 });
  };
  const openOwnerMessages = () => {
    const params = new URLSearchParams({ listingId: property.id, propertyTitle: property.title, ownerName: property.poster?.businessName || property.poster?.name || 'Property owner', propertyImage: property.image, propertyLocation: property.location });
    router.push(`/messages?${params.toString()}`);
  };
  const openPropertyRequest = () => {
    setViewerMode(null);
    setRequestOpen(true);
  };

  return (
    <>
      <main className="property-detail-page">
        <header className="property-detail-header">
          <button type="button" onClick={() => router.back()}>← Back</button>
          <strong>Umutungo</strong>
          <div className="property-detail-header-actions">
            <InterfacePreferences className="property-detail-preferences" />
          </div>
        </header>
        <section className="property-detail-layout">
          <div className="property-detail-media">
            {(viewerMode === 'tour' || viewerMode === 'plan') ? <PropertyViewer language="English" property={property} initialMode={viewerMode} embedded onClose={() => setViewerMode(null)} /> : <>
            {supports3DView && <div className="property-detail-view-actions" aria-label="Property media">
              <button type="button" onClick={() => setViewerMode('tour')}>
                <Icon name="sparkles" size={15} />
                Explore in 3D
              </button>
              <button type="button" onClick={() => setViewerMode('plan')}>
                <Icon name="home" size={15} />
                Floor plan
              </button>
            </div>}
            <img className="property-detail-cover" src={(property.images ?? [property.image])[selectedImageIndex] ?? property.image} alt={property.title} />
            <div className="property-detail-gallery">
              {(property.images ?? [property.image]).map((image, index) => <button className={selectedImageIndex === index ? 'is-selected' : ''} type="button" key={`${image}-${index}`} aria-label={`Show property photo ${index + 1}`} aria-pressed={selectedImageIndex === index} onClick={() => setSelectedImageIndex(index)}><img src={image} alt="" /></button>)}
            </div>
            </>}
            {supports3DView && <section className="viewer-tour-feedback property-detail-feedback property-detail-feedback-mobile" aria-labelledby="property-tour-feedback-title-mobile">
              <div><strong id="property-tour-feedback-title-mobile">Are you satisfied with the 3D view to continue checkout?</strong><span>Choose what you would like to do next.</span></div>
              <div className="viewer-tour-feedback-options">
                <button type="button" className={tourSatisfaction === 'yes' ? 'is-selected' : ''} aria-pressed={tourSatisfaction === 'yes'} onClick={() => { setTourSatisfaction('yes'); openPropertyRequest(); }}>Yes, I’m satisfied</button>
                <button type="button" className={tourSatisfaction === 'no' ? 'is-selected' : ''} aria-pressed={tourSatisfaction === 'no'} onClick={() => { setTourSatisfaction('no'); openDirectionsFromCurrentLocation(); }}>No, I’d like to visit</button>
                <button className="property-contact-button" type="button" onClick={openOwnerMessages}><Icon name="bookPen" size={15} /> Message owner</button>
              </div>
              {tourSatisfaction === 'no' && directionsMapUrl && <><div className="property-inline-directions"><div><strong>Directions to this property</strong><button type="button" onClick={() => setDirectionsMapUrl('')} aria-label="Close directions"><Icon name="x" size={14} /></button></div><iframe src={directionsMapUrl} title={`Directions to ${property.title}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div><button className="property-detail-rent-button" type="button" onClick={openPropertyRequest}>Continue to get this property <Icon name="arrow" size={15} /></button></>}
            </section>}
            {(property.amenities?.length || property.tags?.length) ? <section className="property-detail-content" aria-label="Property features">
              <article className="property-detail-about"><span className="property-detail-section-label">Features and accessibility</span><p>{[...(property.amenities ?? []), ...(property.tags ?? [])].join(' · ')}</p></article>
            </section> : null}
          </div>
          <article className="property-detail-copy">
            {property.type.trim().toLowerCase() !== 'other' && <span className="property-detail-type">{property.type}</span>}
            <h1>{property.title}</h1>
            <p className="property-detail-location">{property.location}</p>
            <strong className="property-detail-price">{property.price}{property.priceNote && !/^\s*asking\s*$/i.test(property.priceNote) && <> <small>{property.priceNote}</small></>}</strong>
            <div className="property-detail-actions">
              <button className="property-detail-rent-button" type="button" onClick={openPropertyRequest}>{property.availableFor === 'rent' ? 'Rent this property' : property.availableFor === 'both' ? 'Get or rent this property' : 'Get this property'} <Icon name="arrow" size={15} /></button>
            </div>
            {(property.type === 'House' || property.area > 0) && <div className="property-detail-stats">
              {property.type === 'House' && <><span><b>{property.bedrooms}</b> beds</span><span><b>{property.bathrooms}</b> baths</span></>}
              {property.area > 0 && <span><b>{property.area}</b> m²</span>}
            </div>}
            <div className="property-detail-meta"><span className="property-detail-listed">{property.listed}</span><span className="property-detail-availability">{property.availableFor === 'rent' ? 'Available to rent' : property.availableFor === 'both' ? 'Available to buy or rent' : 'Available to buy'}</span></div>
            <div className="property-detail-after-negotiability">
            {property.poster && <div className="property-detail-meta"><span>Advertiser: {property.poster.businessName || property.poster.name} ({property.poster.role}){property.poster.verified ? ' · Verified' : ''}</span></div>}
            <article className="property-detail-about property-detail-description"><span className="property-detail-section-label">Description</span><p>{property.description?.trim() || 'Contact the property owner for more information about this listing.'}</p></article>
            {supports3DView && <section className="viewer-tour-feedback property-detail-feedback property-detail-feedback-desktop" aria-labelledby="property-tour-feedback-title">
              <div><strong id="property-tour-feedback-title">Are you satisfied with the 3D view to continue checkout?</strong><span>Choose what you would like to do next.</span></div>
              <div className="viewer-tour-feedback-options">
                <button type="button" className={tourSatisfaction === 'yes' ? 'is-selected' : ''} aria-pressed={tourSatisfaction === 'yes'} onClick={() => { setTourSatisfaction('yes'); openPropertyRequest(); }}>Yes, I’m satisfied</button>
                <button type="button" className={tourSatisfaction === 'no' ? 'is-selected' : ''} aria-pressed={tourSatisfaction === 'no'} onClick={() => { setTourSatisfaction('no'); openDirectionsFromCurrentLocation(); }}>No, I’d like to visit</button>
                <button className="property-contact-button" type="button" onClick={openOwnerMessages}><Icon name="bookPen" size={15} /> Message owner</button>
              </div>
              {tourSatisfaction === 'no' && directionsMapUrl && <><div className="property-inline-directions"><div><strong>Directions to this property</strong><button type="button" onClick={() => setDirectionsMapUrl('')} aria-label="Close directions"><Icon name="x" size={14} /></button></div><iframe src={directionsMapUrl} title={`Directions to ${property.title}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div><button className="property-detail-rent-button" type="button" onClick={openPropertyRequest}>Continue to get this property <Icon name="arrow" size={15} /></button></>}
            </section>}
            </div>
          </article>
        </section>
      </main>
      {requestOpen && (
        <PropertyViewer
          language="English"
          property={property}
          initialMode="photos"
          initialImageIndex={selectedImageIndex}
          initialRequest
          onClose={() => setRequestOpen(false)}
        />
      )}
      {galleryOpen && <PropertyViewer language="English" property={property} initialMode="photos" initialImageIndex={selectedImageIndex} onClose={() => setGalleryOpen(false)} />}
    </>
  );
}
