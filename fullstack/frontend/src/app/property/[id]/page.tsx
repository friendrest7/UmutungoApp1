'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { PropertyPlaceholder } from '../../../components/PropertyCard';
import { Icon } from '../../../components/Icons';
import { InterfacePreferences } from '../../../components/InterfacePreferences';
import { PropertyViewer } from '../../../components/PropertyViewer';
import { publicUmutungoApi } from '../../../lib/umutungoApi';
import { listedOn, toProperty, type ApiListing as SharedApiListing } from '../../../lib/listings';
import { propertySlug } from '../../../lib/listings';
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
    image: item.media?.[0]?.url ?? '/properties/house-01.jpg',
    images: item.media?.map((media) => media.url),
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
  const [viewerMode, setViewerMode] = useState<'tour' | 'plan' | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);

  useEffect(() => {
    const open3d = new URLSearchParams(window.location.search).get('view') === '3d';
    const id = decodeURIComponent(params.id ?? '');
    const isListingId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    setProperty(null);
    const listingRequest = isListingId
      ? publicUmutungoApi<ApiListing>(`/api/v1/listings/${encodeURIComponent(id)}`)
      : publicUmutungoApi<{ items: ApiListing[] }>('/api/v1/listings', { cache: 'no-store' }).then((result) => result?.items.find((item) => propertySlug(item.title) === id) ?? null);
    void listingRequest
      .then((result) => {
        if (result) {
          const mappedProperty = toProperty(result as SharedApiListing);
          setProperty(mappedProperty);
          if (open3d && mappedProperty.type === 'House') setViewerMode('tour');
          return;
        }
        const localProperty = isLocalDevelopmentHost() ? readLocalPropertyListings().find((item) => item.id === id || propertySlug(item.title) === id) : undefined;
        if (localProperty) {
          setProperty(localProperty);
          if (open3d && localProperty.type === 'House') setViewerMode('tour');
        }
      })
      .catch(() => {
        const localProperty = isLocalDevelopmentHost() ? readLocalPropertyListings().find((item) => item.id === id || propertySlug(item.title) === id) : undefined;
        if (localProperty) {
          setProperty(localProperty);
          if (open3d && localProperty.type === 'House') setViewerMode('tour');
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

  return (
    <>
      <main className="property-detail-page">
        <header className="property-detail-header">
          <button type="button" onClick={() => router.back()}>← Back</button>
          <strong>Umutungo</strong>
          <div className="property-detail-header-actions">
            <InterfacePreferences />
            <a href="/post-property">Post property</a>
          </div>
        </header>
        <section className="property-detail-layout">
          <div className="property-detail-media">
            {property.type === 'House' && <div className="property-detail-view-actions" aria-label="Property media">
              <button type="button" onClick={() => setViewerMode('tour')}>
                <Icon name="sparkles" size={15} />
                Explore in 3D
              </button>
              <button type="button" onClick={() => setViewerMode('plan')}>
                <Icon name="home" size={15} />
                Floor plan
              </button>
            </div>}
            <img className="property-detail-cover" src={property.image} alt={property.title} />
            <div className="property-detail-gallery">
              {(property.images ?? [property.image]).map((image) => <img src={image} alt="" key={image} />)}
            </div>
          </div>
          <article className="property-detail-copy">
            <span className="property-detail-type">{property.type}</span>
            <h1>{property.title}</h1>
            <p className="property-detail-location">{property.location}</p>
            <strong className="property-detail-price">{property.price}{property.priceNote && !/^\s*asking\s*$/i.test(property.priceNote) && <> <small>{property.priceNote}</small></>}</strong>
            <button className="property-detail-rent-button" type="button" onClick={() => setRequestOpen(true)}>{property.availableFor === 'rent' ? 'Rent this property' : property.availableFor === 'both' ? 'Get or rent this property' : 'Get this property'} <Icon name="arrow" size={15} /></button>
            <div className="property-detail-stats">
              {property.type === 'House' && <><span><b>{property.bedrooms}</b> beds</span><span><b>{property.bathrooms}</b> baths</span></>}
              {property.area > 0 && <span><b>{property.area}</b> m²</span>}
            </div>
            <span className="property-detail-listed">{property.listed}</span>
            <span className="property-detail-availability">{property.availableFor === 'rent' ? 'Available to rent' : property.availableFor === 'both' ? 'Available to buy or rent' : 'Available to buy'}</span>
            <div className="property-detail-poster">
              <span className="property-poster-avatar">{property.poster?.name.slice(0, 1) ?? 'U'}</span>
              <div>
                <strong>{property.poster?.businessName ?? property.poster?.name ?? 'Verified property poster'}</strong>
                <small>{property.poster?.role ?? 'Property Owner'}{property.poster?.verified ? ' · Verified' : ''}</small>
                <small>{property.poster?.location ?? property.location}</small>
              </div>
            </div>
          </article>
        </section>
        <section className="property-detail-content" aria-label="Property information">
          <article className="property-detail-about"><span className="property-detail-section-label">Property details</span><h2>About this listing</h2><p>{property.description?.trim() || 'Contact the property owner for more information about this listing.'}</p></article>
          <aside className="property-detail-next-step"><span className="property-detail-section-label">Interested?</span><h2>Take a closer look</h2><p>Review the photos and listing details, then contact the poster to ask about availability and next steps.</p>{property.poster?.phone && <a href={`tel:${property.poster.phone}`}>Contact listing owner <Icon name="arrow" size={15} /></a>}</aside>
        </section>
      </main>
      {(viewerMode || requestOpen) && (
        <PropertyViewer
          language="English"
          property={property}
          initialMode={viewerMode ?? 'photos'}
          initialRequest={requestOpen}
          onClose={() => { setViewerMode(null); setRequestOpen(false); }}
        />
      )}
    </>
  );
}
