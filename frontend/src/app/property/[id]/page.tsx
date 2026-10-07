'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { PropertyPlaceholder } from '../../../components/PropertyCard';
import { Icon } from '../../../components/Icons';
import { InterfacePreferences } from '../../../components/InterfacePreferences';
import { PropertyViewer } from '../../../components/PropertyViewer';
import { getDemoProperty } from '../../../data/propertyCatalog';
import { publicUmutungoApi } from '../../../lib/umutungoApi';

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
    priceNote: isRent ? '/ month' : ' asking',
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

  useEffect(() => {
    const id = decodeURIComponent(params.id ?? '');
    const fallback = getDemoProperty(id) ?? null;
    setProperty(fallback);
    void publicUmutungoApi<ApiListing>(`/api/v1/listings/${encodeURIComponent(id)}`)
      .then((result) => {
        if (result) setProperty(fromApi(result));
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
    if (!fallback) setLoading(false);
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
            <img className="property-detail-cover" src={property.image} alt={property.title} />
            <div className="property-detail-view-actions" aria-label="Property media">
              <button type="button" onClick={() => setViewerMode('tour')}>
                <Icon name="sparkles" size={15} />
                3D view
              </button>
              <button type="button" onClick={() => setViewerMode('plan')}>
                <Icon name="home" size={15} />
                Floor plan
              </button>
            </div>
            <div className="property-detail-gallery">
              {(property.images ?? [property.image]).map((image) => <img src={image} alt="" key={image} />)}
            </div>
          </div>
          <article className="property-detail-copy">
            <span className="property-type">{property.type}</span>
            <h1>{property.title}</h1>
            <p className="property-detail-location">{property.location}</p>
            <strong className="property-detail-price">{property.price} <small>{property.priceNote}</small></strong>
            <div className="property-detail-stats">
              <span><b>{property.bedrooms}</b> beds</span>
              <span><b>{property.bathrooms}</b> baths</span>
              <span><b>{property.area}</b> m²</span>
            </div>
            <p>{property.description ?? 'Clear property information to help you take the next step with confidence.'}</p>
            <div className="property-detail-poster">
              <span className="property-poster-avatar">{property.poster?.name.slice(0, 1) ?? 'U'}</span>
              <div>
                <strong>{property.poster?.businessName ?? property.poster?.name ?? 'Verified property poster'}</strong>
                <small>{property.poster?.role ?? 'Property Owner'}{property.poster?.verified ? ' · Verified' : ''}</small>
                <small>{property.poster?.location ?? property.location}</small>
              </div>
            </div>
            <a className="property-detail-cta" href={`mailto:hello@umutungo.rw?subject=${encodeURIComponent(`Enquiry about ${property.title}`)}`}>
              Request information →
            </a>
            <small className="property-detail-note">Contact details shown here are limited to the poster’s public, verified business information.</small>
          </article>
        </section>
      </main>
      {viewerMode && (
        <PropertyViewer
          language="English"
          property={property}
          initialMode={viewerMode}
          onClose={() => setViewerMode(null)}
        />
      )}
    </>
  );
}
