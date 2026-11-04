'use client';

import Link from 'next/link';
import { Icon } from './Icons';

export type AdvertiseListing = {
  id: string;
  title: string;
  type: string;
  intent: string;
  location: string;
  price: string;
  priceNote: string;
  cover: string;
  status: string;
  featured?: boolean;
};

export function LandlordAdvertisePropertiesSection<T extends AdvertiseListing>({
  listings,
  onFeature,
  notice,
  canAdvertise,
  audience = 'Owner',
  upgradeHref = '/upgrade/owner',
}: {
  listings: T[];
  onFeature: (listing: T) => void;
  notice: string;
  canAdvertise: boolean;
  audience?: 'Owner' | 'Komisiyoneri';
  upgradeHref?: string;
}) {
  const publishedListings = listings.filter((listing) => listing.status === 'published');
  const visibleListings = canAdvertise ? publishedListings : publishedListings.filter((listing) => listing.featured);
  return <section className="tenant-workspace-section landlord-advertise-workspace">
    <div className="tenant-workspace-heading">
      <div><span className="role-dashboard-eyebrow">Landing page promotion</span><h2>Advertise a property</h2><p>{canAdvertise ? 'Choose which published listings to recommend to people visiting the Umutungo home page.' : `Property promotion is included with an active Silver, Gold, or Platinum ${audience} plan.`}</p></div>
      <span className="tenant-workspace-icon"><Icon name="sparkles" size={22} /></span>
    </div>
    {!canAdvertise && <div className="landlord-advertise-upgrade"><div><strong>Upgrade required to advertise</strong><p>Choose a {audience} plan to recommend listings on the home page.</p></div><Link className="role-dashboard-primary" href={upgradeHref}><Icon name="sparkles" size={15} /> View {audience} plans</Link></div>}
    {notice && <p className="workspace-action-notice" role="status"><Icon name="check" size={14} /> {notice}</p>}
    {visibleListings.length ? <div className="landlord-advertise-grid">{visibleListings.map((listing) => <article className={`landlord-property-card landlord-advertise-card ${listing.featured ? 'is-featured' : ''}`} key={listing.id}>
      <div className="landlord-property-image"><img src={listing.cover} alt={listing.title} /><span>{listing.featured ? 'Recommended' : 'Published'}</span></div>
      <div className="landlord-property-copy">
        <div><span className="role-dashboard-eyebrow">{listing.type} - {listing.intent}</span><h3>{listing.title}</h3><p>{listing.location}</p></div>
        <strong>{listing.price} <small>{listing.priceNote}</small></strong>
        {listing.featured ? <button className="landlord-unrecommend-choice" type="button" onClick={() => onFeature(listing)} aria-pressed="true"><Icon name="check" size={15} />Unrecommend</button> : <button className="landlord-feature-choice" type="button" onClick={() => onFeature(listing)} aria-pressed="false"><Icon name="sparkles" size={15} />Recommend on home</button>}
      </div>
    </article>)}</div> : canAdvertise ? <div className="landlord-empty-properties"><span className="tenant-workspace-icon"><Icon name="sparkles" size={22} /></span><h3>No published properties yet</h3><p>Publish a listing first, then select it here to feature it on the landing page.</p><Link className="role-dashboard-primary" href="/post-property"><Icon name="bookPen" size={16} /> Post a property</Link></div> : !publishedListings.some((listing) => listing.featured) && <div className="landlord-empty-properties"><span className="tenant-workspace-icon"><Icon name="sparkles" size={22} /></span><h3>No advertised properties</h3><p>Upgrade to a {audience} plan to recommend a published listing on the landing page.</p></div>}
  </section>;
}
