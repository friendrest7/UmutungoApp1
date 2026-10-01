'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ChangeEvent, useEffect, useState } from 'react';
import { AuthModal } from '../../components/AuthModal';
import { Icon } from '../../components/Icons';
import { Logo } from '../../components/Logo';
import { getDistrictNames, getSectorNames, provinceNames } from '../../data/rwandaLocations';
import { umutungoApi } from '../../lib/umutungoApi';

type PropertyType = 'House' | 'Apartment' | 'Land' | 'Commercial' | 'Office' | 'Hospitality' | 'Vehicle' | 'Furniture' | 'Appliance' | 'Equipment' | 'Other';
type PostingRole = 'Komisiyoneri' | 'Landlord' | 'Property Owner';
type Intent = 'For rent' | 'For sale';

const steps = [
  { number: 1, label: 'Property story', note: 'What are you offering?' },
  { number: 2, label: 'Place & price', note: 'Help people find it.' },
  { number: 3, label: 'Media & publish', note: 'Make it memorable.' },
];

const typeOptions: { key: PropertyType; label: string; icon: 'home' | 'building' | 'leaf' | 'users' }[] = [
  { key: 'House', label: 'Houses', icon: 'home' },
  { key: 'Apartment', label: 'Apartments', icon: 'building' },
  { key: 'Land', label: 'Land', icon: 'leaf' },
  { key: 'Commercial', label: 'Commercial', icon: 'building' },
  { key: 'Office', label: 'Offices', icon: 'building' },
  { key: 'Equipment', label: 'Equipment', icon: 'users' },
  { key: 'Hospitality', label: 'Hospitality', icon: 'home' },
  { key: 'Vehicle', label: 'Vehicle', icon: 'building' },
  { key: 'Furniture', label: 'Furniture', icon: 'building' },
  { key: 'Appliance', label: 'Appliance', icon: 'building' },
  { key: 'Other', label: 'Other', icon: 'users' },
];

const curatedImages: Record<PropertyType, string[]> = {
  House: ['/properties/house-01.jpg', '/properties/tour-living.jpg', '/properties/tour-kitchen.jpg'],
  Apartment: ['/properties/apartment-01.jpg', '/properties/apartment-02.jpg', '/properties/tour-bedroom-real.jpg'],
  Land: ['/properties/land-01.jpg'],
  Commercial: ['/properties/commercial-01.jpg', '/properties/commercial-02.jpg'],
  Office: ['/properties/commercial-02.jpg', '/properties/commercial-01.jpg'],
  Equipment: ['/properties/commercial-01.jpg'],
  Hospitality: ['/properties/house-02.jpg', '/properties/tour-living.jpg'],
  Vehicle: ['/properties/commercial-02.jpg'], Furniture: ['/properties/tour-living.jpg'], Appliance: ['/properties/tour-kitchen.jpg'], Other: ['/properties/story-detail.jpg'],
};

const defaultTitles: Record<PropertyType, string> = {
  House: 'Bright family home with room to breathe',
  Apartment: 'Light-filled apartment in Kigali',
  Land: 'A ready-to-build plot with a clear future',
  Commercial: 'Flexible commercial space for your next move',
  Office: 'A polished office ready for productive work',
  Equipment: 'Reliable equipment ready for its next operator',
  Hospitality: 'A welcoming stay with room to remember',
  Vehicle: 'A reliable vehicle ready for its next journey', Furniture: 'Furniture to make your space feel complete', Appliance: 'A useful appliance in good working condition', Other: 'A useful asset ready for its next purpose',
};

const amenityOptions = ['Parking', 'Garden', 'Furnished', 'Security', 'Water tank', 'Internet ready'];

function RwandaLocationFields({ province, onProvinceChange, district, districtOptions, onDistrictChange, sector, sectorOptions, onSectorChange, cell, cellOptions, onCellChange, village, villageOptions, onVillageChange, loading, error, gpsPin, onCaptureGps }: { province: string; onProvinceChange: (value: string) => void; district: string; districtOptions: string[]; onDistrictChange: (value: string) => void; sector: string; sectorOptions: string[]; onSectorChange: (value: string) => void; cell: string; cellOptions: string[]; onCellChange: (value: string) => void; village: string; villageOptions: string[]; onVillageChange: (value: string) => void; loading: boolean; error: string; gpsPin: string; onCaptureGps: () => void }) {
  return <><div className="post-location-hierarchy"><label className="post-field"><span>Province</span><select value={province} onChange={(event) => onProvinceChange(event.target.value)}>{provinceNames.map((item) => <option key={item}>{item}</option>)}</select></label><label className="post-field"><span>District</span><select value={district} onChange={(event) => onDistrictChange(event.target.value)} disabled={!districtOptions.length}>{districtOptions.map((item) => <option key={item}>{item}</option>)}</select></label><label className="post-field"><span>Sector</span><select value={sector} onChange={(event) => onSectorChange(event.target.value)} disabled={loading || !sectorOptions.length}><option value="">{loading ? 'Loading sectors…' : 'Select sector'}</option>{sectorOptions.map((item) => <option key={item}>{item}</option>)}</select></label><label className="post-field"><span>Cell <small>Optional</small></span><select value={cell} onChange={(event) => onCellChange(event.target.value)} disabled={!cellOptions.length}><option value="">Select cell</option>{cellOptions.map((item) => <option key={item}>{item}</option>)}</select></label><label className="post-field"><span>Village <small>Optional</small></span><select value={village} onChange={(event) => onVillageChange(event.target.value)} disabled={!villageOptions.length}><option value="">Select village</option>{villageOptions.map((item) => <option key={item}>{item}</option>)}</select></label></div>{error && <p className="post-location-error" role="alert">{error}</p>}<div className="post-location-tools"><button className="post-secondary-button" type="button" onClick={onCaptureGps}><Icon name="pin" size={14} /> {gpsPin ? 'GPS pin saved' : 'Use current location'}</button>{gpsPin && <small>{gpsPin}</small>}</div></>;
}

export type LandlordListing = {
  id: string;
  title: string;
  type: PropertyType;
  intent: Intent;
  location: string;
  province: string;
  district: string;
  sector: string;
  cell?: string;
  village?: string;
  gpsPin?: string;
  price: string;
  priceNote: string;
  cover: string;
  images: string[];
  bedrooms: string;
  bathrooms: string;
  area: string;
  amenities: string[];
  status: 'Draft' | 'Scheduled';
  scheduledFor?: string;
  expiresAt?: string;
  savedAt: string;
};

function PostingSelection({ role, category, onRoleChange, onCategoryChange, onContinue, error }: { role: PostingRole | null; category: PropertyType; onRoleChange: (value: PostingRole) => void; onCategoryChange: (value: PropertyType) => void; onContinue: () => void; error: string }) {
  return <main className="posting-selection-page"><header className="post-property-header"><Link href="/" aria-label="Umutungo home"><Logo /></Link><Link className="post-home-link" href="/"><Icon name="x" size={14} /> Exit</Link></header><section className="posting-selection-shell"><div><span className="post-eyebrow">New listing</span><h1>Start with the role<br /><em>and asset.</em></h1><p>Choose who you are and what you are offering. Umutungo will then show the relevant listing fields.</p></div><div className="posting-selection-card"><fieldset><legend>Who are you posting as?</legend><div className="posting-role-grid">{(['Komisiyoneri', 'Landlord', 'Property Owner'] as PostingRole[]).map((item) => <button type="button" key={item} className={role === item ? 'is-selected' : ''} onClick={() => onRoleChange(item)}><strong>{item}</strong><small>{item === 'Komisiyoneri' ? 'List for clients and manage enquiries.' : item === 'Landlord' ? 'Manage rental homes and tenants.' : 'List your hotels, vehicles, furniture, appliances, equipment, or other assets.'}</small></button>)}</div></fieldset><fieldset><legend>What are you listing?</legend><div className="posting-category-grid">{typeOptions.map((item) => <button type="button" key={item.key} className={category === item.key ? 'is-selected' : ''} onClick={() => onCategoryChange(item.key)}><Icon name={item.icon} size={18} /><span>{item.label}</span></button>)}</div></fieldset>{error && <p className="post-location-error" role="alert">{error}</p>}<button className="post-primary-button" type="button" onClick={onContinue}>Continue to listing form <Icon name="arrow" size={15} /></button></div></section></main>;
}

export default function PostPropertyPage() {
  const [step, setStep] = useState(1);
  const [propertyType, setPropertyType] = useState<PropertyType>('House');
  const [intent, setIntent] = useState<Intent>('For rent');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('City of Kigali');
  const [district, setDistrict] = useState('Gasabo');
  const [sector, setSector] = useState('Kacyiru');
  const [cell, setCell] = useState('');
  const [village, setVillage] = useState('');
  const [gpsPin, setGpsPin] = useState('');
  const [locationOptions, setLocationOptions] = useState<string[]>(getSectorNames('City of Kigali', 'Gasabo'));
  const [cellOptions, setCellOptions] = useState<string[]>([]);
  const [villageOptions, setVillageOptions] = useState<string[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [marketIntent, setMarketIntent] = useState('Buy or rent');
  const [priceRange, setPriceRange] = useState('Any price');
  const [publicationMode, setPublicationMode] = useState<'Draft' | 'Scheduled'>('Draft');
  const [scheduledFor, setScheduledFor] = useState('');
  const [ownerTier, setOwnerTier] = useState('Silver · 90 days');
  const [address, setAddress] = useState('');
  const [price, setPrice] = useState('1,250,000');
  const [bedrooms, setBedrooms] = useState('4');
  const [bathrooms, setBathrooms] = useState('3');
  const [area, setArea] = useState('220');
  const [amenities, setAmenities] = useState<string[]>(['Parking', 'Security']);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [selectedCover, setSelectedCover] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [accessRole, setAccessRole] = useState<'Landlord' | 'Property Owner' | 'Commissioner / Komisiyoneri' | null>(null);
  const [postingRole, setPostingRole] = useState<PostingRole | null>(null);
  const [selectionComplete, setSelectionComplete] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [saveError, setSaveError] = useState('');

  const gallery = uploadedImages.length ? uploadedImages : curatedImages[propertyType];
  const cover = selectedCover ?? gallery[0];
  const listingTitle = title.trim() || defaultTitles[propertyType];
  const isLand = propertyType === 'Land';
  const isAsset = ['Vehicle', 'Furniture', 'Appliance', 'Equipment', 'Other'].includes(propertyType);
  const isAccommodation = ['House', 'Apartment', 'Hospitality'].includes(propertyType);
  const districtOptions = getDistrictNames(location);

  useEffect(() => {
    const nextDistricts = getDistrictNames(location);
    if (!nextDistricts.includes(district)) setDistrict(nextDistricts[0] ?? '');
    if (location !== 'City of Kigali') setSector('');
    setCell('');
    setVillage('');
    setCellOptions([]);
    setVillageOptions([]);
  }, [location]);

  useEffect(() => {
    const localSectors = getSectorNames(location, district);
    if (localSectors.length) {
      setLocationOptions(localSectors);
      if (!localSectors.includes(sector)) setSector(localSectors[0]);
      setLocationError('');
      return;
    }
    if (!location || !district) return;
    let cancelled = false;
    setLocationLoading(true);
    fetch(`/api/locations?level=sector&province=${encodeURIComponent(location)}&district=${encodeURIComponent(district)}`)
      .then((response) => response.ok ? response.json() as Promise<{ values?: string[]; error?: string }> : Promise.reject(new Error('Location lookup failed.')))
      .then((result) => { if (!cancelled) { setLocationOptions(result.values ?? []); setSector(result.values?.[0] ?? ''); setLocationError(result.error ?? ''); } })
      .catch(() => { if (!cancelled) { setLocationOptions([]); setSector(''); setLocationError('Sector data is unavailable. Try again before saving this listing.'); } })
      .finally(() => { if (!cancelled) setLocationLoading(false); });
    return () => { cancelled = true; };
  }, [location, district]);

  useEffect(() => {
    if (!location || !district || !sector) return;
    let cancelled = false;
    fetch(`/api/locations?level=cell&province=${encodeURIComponent(location)}&district=${encodeURIComponent(district)}&sector=${encodeURIComponent(sector)}`)
      .then((response) => response.ok ? response.json() as Promise<{ values?: string[] }> : Promise.reject(new Error('Cell lookup failed.')))
      .then((result) => { if (!cancelled) setCellOptions(result.values ?? []); })
      .catch(() => { if (!cancelled) setCellOptions([]); });
    return () => { cancelled = true; };
  }, [location, district, sector]);

  useEffect(() => {
    if (!location || !district || !sector || !cell) { setVillageOptions([]); return; }
    let cancelled = false;
    fetch(`/api/locations?level=village&province=${encodeURIComponent(location)}&district=${encodeURIComponent(district)}&sector=${encodeURIComponent(sector)}&cell=${encodeURIComponent(cell)}`)
      .then((response) => response.ok ? response.json() as Promise<{ values?: string[] }> : Promise.reject(new Error('Village lookup failed.')))
      .then((result) => { if (!cancelled) setVillageOptions(result.values ?? []); })
      .catch(() => { if (!cancelled) setVillageOptions([]); });
    return () => { cancelled = true; };
  }, [location, district, sector, cell]);

  useEffect(() => {
    try {
      const user = JSON.parse(window.localStorage.getItem('umutungo-demo-user') ?? 'null') as { role?: string } | null;
      const userRole = user?.role;
      setAccessRole(userRole === 'Landlord' || userRole === 'Property Owner' || userRole === 'Commissioner / Komisiyoneri' ? userRole : null);
      if (userRole === 'Landlord' || userRole === 'Property Owner' || userRole === 'Commissioner / Komisiyoneri') setPostingRole(userRole === 'Commissioner / Komisiyoneri' ? 'Komisiyoneri' : userRole);
    } catch {
      setAccessRole(null);
    } finally {
      setCheckingAccess(false);
    }
  }, []);

  useEffect(() => {
    const labels = Array.from(document.querySelectorAll('.post-stats-grid .post-field > span:first-child'));
    if (isAsset) {
      ['Quantity', 'Condition', 'Specifications'].forEach((label, index) => { if (labels[index]) labels[index].textContent = label; });
    } else if (isLand) {
      ['Plot size', 'Tenure', 'Road access'].forEach((label, index) => { if (labels[index]) labels[index].textContent = label; });
    } else {
      ['Bedrooms', 'Bathrooms', 'Floor area'].forEach((label, index) => { if (labels[index]) labels[index].textContent = label; });
    }
  }, [isAsset, isLand, propertyType]);

  const readImage = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    const images = await Promise.all(files.slice(0, 6).map(readImage));
    setUploadedImages(images);
    setSelectedCover(null);
  };

  const toggleAmenity = (amenity: string) => setAmenities((current) => current.includes(amenity) ? current.filter((item) => item !== amenity) : [...current, amenity]);
  const continueToForm = () => {
    if (!postingRole) { setSaveError('Choose a posting role before continuing.'); return; }
    if (!accessRole) { setAuthOpen(true); return; }
    const roleMatches = (postingRole === 'Komisiyoneri' && accessRole === 'Commissioner / Komisiyoneri') || (postingRole !== 'Komisiyoneri' && (accessRole === 'Landlord' || accessRole === 'Property Owner'));
    if (!roleMatches) { setSaveError(`This account is signed in as ${accessRole}. Choose the matching posting role or sign in with another account.`); return; }
    setSaveError('');
    setSelectionComplete(true);
  };
  const next = () => setStep((current) => Math.min(3, current + 1));
  const previous = () => setStep((current) => Math.max(1, current - 1));
  const saveListing = async () => {
    if (!district || !sector) { setLocationError('Choose a valid district and sector before saving the listing.'); setStep(2); return; }
    const expiryDays = accessRole === 'Commissioner / Komisiyoneri' ? 30 : ownerTier.startsWith('Silver') ? 90 : ownerTier.startsWith('Gold') ? 180 : 365;
    setSaveError('');
    const amount = Number(price.replace(/[^0-9.]/g, '')) || 0;
    let databaseListing: { id?: string; status?: string; expires_at?: string } | null = null;
    try {
      databaseListing = await umutungoApi<{ id?: string; status?: string; expires_at?: string }>('/api/v1/listings', {
        method: 'POST',
        body: JSON.stringify({
          category: propertyType.toLowerCase(),
          transaction_type: intent === 'For rent' ? 'rent_out' : 'sell',
          title: listingTitle,
          description,
          price: amount,
          currency: 'RWF',
          province: location,
          district,
          sector,
          cell,
          village,
          publish_at: publicationMode === 'Scheduled' && scheduledFor ? new Date(scheduledFor).toISOString() : null,
          tags: amenities,
          amenities,
          contact_method: 'message',
          media: gallery.map((url) => ({ type: 'photo', url })),
          measurements: { building_size: Number(area) || 0, bedrooms: Number(bedrooms) || 0, bathrooms: Number(bathrooms) || 0, parking: amenities.includes('Parking') ? 1 : 0 },
        }),
      });
    } catch {
      setSaveError('The listing could not be saved to the hosted database. It was kept locally so you can continue testing.');
    }
    const listing: LandlordListing = { id: databaseListing?.id ?? `listing-${Date.now()}`, title: listingTitle, type: propertyType, intent, location: `${address || sector}, ${district}, ${location}`, province: location, district, sector, cell, village, gpsPin, price: `RWF ${price || '0'}`, priceNote: intent === 'For rent' ? '/ month' : ' asking', cover, images: gallery, bedrooms, bathrooms, area, amenities, status: publicationMode, savedAt: new Date().toISOString(), scheduledFor: scheduledFor || undefined, expiresAt: databaseListing?.expires_at ?? new Date(Date.now() + expiryDays * 86400000).toISOString() };
    const storageKey = accessRole === 'Commissioner / Komisiyoneri' ? 'umutungo-commissioner-properties' : 'umutungo-landlord-properties';
    try {
      const existing = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]') as LandlordListing[];
      window.localStorage.setItem(storageKey, JSON.stringify([listing, ...existing]));
    } catch {
      window.localStorage.setItem(storageKey, JSON.stringify([listing]));
    }
    window.location.assign(accessRole === 'Commissioner / Komisiyoneri' ? '/commissioner' : '/landlord');
  };

  if (checkingAccess) return <main className="landlord-access-page"><p>Checking your landlord account…</p></main>;
  if (!selectionComplete) return <><PostingSelection role={postingRole} category={propertyType} onRoleChange={(value) => { setPostingRole(value); setSaveError(''); }} onCategoryChange={(value) => { setPropertyType(value); setSaveError(''); }} onContinue={continueToForm} error={saveError} /><AuthModal open={authOpen} role={postingRole === 'Komisiyoneri' ? 'Commissioner / Komisiyoneri' : postingRole === 'Landlord' ? 'Landlord' : postingRole === 'Property Owner' ? 'Property Owner' : undefined} onClose={() => setAuthOpen(false)} onSuccess={(accountRole) => { const nextRole = accountRole === 'Commissioner / Komisiyoneri' ? 'Komisiyoneri' : accountRole === 'Property Owner' ? 'Property Owner' : accountRole === 'Landlord' ? 'Landlord' : null; if (nextRole) { setAccessRole(accountRole as 'Landlord' | 'Property Owner' | 'Commissioner / Komisiyoneri'); setPostingRole((current) => current ?? nextRole); setAuthOpen(false); } else setSaveError('A Komisiyoneri, Landlord, or Property Owner account is required to post a listing.'); }} /></>;

  if (published) {
    return <main className="post-property-page"><header className="post-property-header"><Link href="/" aria-label="Umutungo home"><Logo /></Link><div className="post-header-links"><Link className="post-home-link" href="/"><Icon name="home" size={14} /> Home</Link><Link className="post-exit-link" href="/"><Icon name="x" size={14} /> Exit builder</Link></div></header><section className="post-success"><div className="post-success-mark"><Icon name="check" size={30} /></div><p className="post-eyebrow">Listing saved</p><h1>Your place is ready<br /><em>for its next chapter.</em></h1><p>We have saved “{listingTitle}” as a new listing draft. Add verification documents from your dashboard when you are ready to publish it publicly.</p><div className="post-success-actions"><Link className="post-primary-button" href="/"><span>Return to marketplace</span><Icon name="arrow" size={15} /></Link><button className="post-secondary-button" type="button" onClick={() => setPublished(false)}>Edit listing</button></div></section></main>;
  }

  return <main className="post-property-page">
    <header className="post-property-header"><Link href="/" aria-label="Umutungo home"><Logo /></Link><div className="post-header-center"><span className="post-live-dot" /> Draft autosaved</div><div className="post-header-links"><Link className="post-home-link" href="/"><Icon name="home" size={14} /> Home</Link><Link className="post-exit-link" href="/"><Icon name="x" size={14} /> Exit builder</Link></div></header>
    <div className="post-property-layout">
      <aside className="post-property-sidebar"><div><p className="post-eyebrow">New listing</p><h1>Make a place<br /><em>feel possible.</em></h1><p className="post-sidebar-copy">Tell the story clearly. The right people are already looking.</p></div><nav className="post-progress" aria-label="Listing steps">{steps.map((item) => <button className={step === item.number ? 'is-active' : step > item.number ? 'is-complete' : ''} type="button" key={item.number} onClick={() => setStep(item.number)}><span className="post-step-number">{step > item.number ? <Icon name="check" size={13} /> : `0${item.number}`}</span><span><strong>{item.label}</strong><small>{item.note}</small></span></button>)}</nav><div className="post-sidebar-tip"><Icon name="sparkles" size={17} /><span><strong>Small detail, big difference</strong><small>Listings with 5+ photos get more attention.</small></span></div></aside>
      <section className="post-property-main">{saveError && <p className="post-save-error" role="alert">{saveError}</p>}
        <div className="post-main-heading"><div><p className="post-eyebrow">Step 0{step} of 03</p><h2>{steps[step - 1].label}</h2></div><span className="post-save-status"><Icon name="check" size={13} /> Saved locally</span></div>
        <div className="post-builder-grid"><div className="post-form-card">{step === 2 && <RwandaLocationFields province={location} onProvinceChange={(value) => { setLocation(value); setLocationError(''); }} district={district} districtOptions={districtOptions} onDistrictChange={(value) => { setDistrict(value); setSector(''); setCell(''); setVillage(''); }} sector={sector} sectorOptions={locationOptions} onSectorChange={(value) => { setSector(value); setCell(''); setVillage(''); }} cell={cell} cellOptions={cellOptions} onCellChange={(value) => { setCell(value); setVillage(''); }} village={village} villageOptions={villageOptions} onVillageChange={setVillage} loading={locationLoading} error={locationError} gpsPin={gpsPin} onCaptureGps={() => navigator.geolocation?.getCurrentPosition((position) => { setGpsPin(`${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`); setLocationError(''); }, () => setLocationError('Location access was not available. You can continue with the administrative location.'))} />}
          {step === 1 && <div className="post-form-section"><div className="post-section-intro"><h3>Start with the essentials</h3><p>Choose a format and give your property a title people will remember.</p></div><div className="post-category-field"><span className="post-field-label">Property category</span><div className="post-category-grid" role="group" aria-label="Property category">{typeOptions.map((item) => <button className={propertyType === item.key ? 'is-selected' : ''} type="button" key={item.key} onClick={() => setPropertyType(item.key)}><span className="post-category-icon"><Icon name={item.icon} size={17} /></span><strong>{item.label}</strong>{propertyType === item.key && <span className="post-category-check"><Icon name="check" size={12} /></span>}</button>)}</div><small className="post-category-help">Choose the category that best describes what you are listing.</small></div><div className="post-field-group"><span className="post-field-label">Listing intent</span><div className="post-segmented"><button className={intent === 'For rent' ? 'is-selected' : ''} type="button" onClick={() => setIntent('For rent')}>For rent</button><button className={intent === 'For sale' ? 'is-selected' : ''} type="button" onClick={() => setIntent('For sale')}>For sale</button></div></div><label className="post-field"><span>Listing title</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={defaultTitles[propertyType]} /></label><label className="post-field"><span>Short description <small>Optional</small></span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What makes this place special? Mention the light, the view, the street or the feeling." rows={4} /></label></div>}
          {step === 2 && <div className="post-form-section"><div className="post-section-intro"><h3>Give it a sense of place</h3><p>A clear location and honest numbers make a listing feel trustworthy.</p></div><div className="post-market-filters"><label className="post-field"><span>Location</span><select value={location} onChange={(event) => setLocation(event.target.value)}><option>Kigali</option><option>Eastern Province</option><option>Northern Province</option><option>Southern Province</option><option>Western Province</option></select></label><label className="post-field"><span>For sale / rent</span><select value={marketIntent} onChange={(event) => { const value = event.target.value; setMarketIntent(value); if (value === 'Buy') setIntent('For sale'); if (value === 'Rent') setIntent('For rent'); }}><option>Buy or rent</option><option>Buy</option><option>Rent</option></select></label><label className="post-field"><span>Price range</span><select value={priceRange} onChange={(event) => setPriceRange(event.target.value)}><option>Any price</option><option>Under RWF 500,000</option><option>RWF 500,000 - 1,000,000</option><option>Over RWF 1,000,000</option></select></label></div><label className="post-field"><span>Neighbourhood</span><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="e.g. Kacyiru, near the offices" /></label><div className="post-price-field"><label className="post-field"><span>{intent === 'For rent' ? 'Monthly price' : 'Asking price'}</span><div className="post-input-prefix"><b>RWF</b><input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="numeric" /></div></label><span className="post-price-note">{intent === 'For rent' ? 'per month' : 'total asking price'}</span></div><div className="post-form-grid post-stats-grid"><label className="post-field"><span>{isLand ? 'Plot size' : 'Bedrooms'}</span><div className="post-input-suffix"><input value={isLand ? area : bedrooms} onChange={(event) => isLand ? setArea(event.target.value) : setBedrooms(event.target.value)} inputMode="numeric" /><b>{isLand ? 'm²' : 'beds'}</b></div></label><label className="post-field"><span>{isLand ? 'Tenure' : 'Bathrooms'}</span><div className="post-input-suffix"><input value={isLand ? 'Freehold' : bathrooms} onChange={(event) => isLand ? null : setBathrooms(event.target.value)} inputMode={isLand ? 'text' : 'numeric'} /><b>{isLand ? '' : 'baths'}</b></div></label><label className="post-field"><span>{isLand ? 'Road access' : 'Floor area'}</span><div className="post-input-suffix"><input value={isLand ? 'Yes' : area} onChange={(event) => isLand ? null : setArea(event.target.value)} inputMode="numeric" /><b>{isLand ? '' : 'm²'}</b></div></label></div><div className="post-field-group"><span className="post-field-label">Highlights</span><div className="post-amenities">{amenityOptions.map((amenity) => <button className={amenities.includes(amenity) ? 'is-selected' : ''} type="button" key={amenity} onClick={() => toggleAmenity(amenity)}>{amenities.includes(amenity) && <Icon name="check" size={12} />}{amenity}</button>)}</div></div></div>}
          {step === 3 && <div className="post-form-section"><div className="post-section-intro"><h3>Let the photos do some talking</h3><p>Choose a cover that sets the mood, then add the details that help someone picture themselves there.</p></div><label className="post-dropzone"><input type="file" accept="image/*" multiple onChange={handleFiles} /><span className="post-upload-icon"><Icon name="download" size={19} /></span><strong>Drop your photos here</strong><small>or click to browse · JPG, PNG up to 10MB each</small></label><div className="post-curated-heading"><span>Start with a curated set</span><small>Swap these for your own any time</small></div><div className="post-image-choices">{curatedImages[propertyType].map((image) => <button className={cover === image ? 'is-selected' : ''} type="button" key={image} onClick={() => { setSelectedCover(image); setUploadedImages([]); }}><Image src={image} alt="Suggested property view" fill sizes="120px" />{cover === image && <span><Icon name="check" size={13} /></span>}</button>)}</div><div className="post-amenities-summary"><span>Selected highlights</span><div>{amenities.length ? amenities.map((amenity) => <b key={amenity}>{amenity}</b>) : <small>Add a few highlights above</small>}</div></div></div>}
          {step === 3 && <div className="post-lifecycle-panel"><div><span className="post-field-label">Publication</span><p>Save privately now or schedule this listing for a future release.</p></div><div className="post-segmented"><button className={publicationMode === 'Draft' ? 'is-selected' : ''} type="button" onClick={() => setPublicationMode('Draft')}>Save as draft</button><button className={publicationMode === 'Scheduled' ? 'is-selected' : ''} type="button" onClick={() => setPublicationMode('Scheduled')}>Schedule</button></div>{publicationMode === 'Scheduled' && <label className="post-field"><span>Publish date and time</span><input type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} required /></label>}{(accessRole === 'Landlord' || accessRole === 'Property Owner') && <label className="post-field"><span>Property Owner subscription tier</span><select value={ownerTier} onChange={(event) => setOwnerTier(event.target.value as 'Silver' | 'Gold' | 'Platinum')}><option>Silver · 90 days</option><option>Gold · 180 days</option><option>Platinum · 365 days</option></select></label>}<small className="post-lifecycle-note">{accessRole === 'Commissioner / Komisiyoneri' ? 'Komisiyoneri listings expire 30 days after publication.' : `Property Owner listings expire according to the ${ownerTier} tier.`}</small></div>}
          <div className="post-form-actions">{step > 1 ? <button className="post-secondary-button" type="button" onClick={previous}><Icon name="arrow" size={14} /> Back</button> : <span />}{step < 3 ? <button className="post-primary-button" type="button" onClick={next}><span>Continue</span><Icon name="arrow" size={15} /></button> : <button className="post-primary-button" type="button" onClick={saveListing}><span>{publicationMode === 'Scheduled' ? 'Schedule listing' : 'Save listing draft'}</span><Icon name="arrow" size={15} /></button>}</div>
        </div><aside className="post-preview-wrap"><div className="post-preview-label"><span>Live preview</span><small>How it will look in Umutungo</small></div><article className="post-preview-card"><div className="post-preview-image"><Image src={cover} alt="Property preview" fill sizes="(max-width: 900px) 100vw, 350px" /><span className="post-preview-badge">{intent}</span><button type="button" aria-label="Save preview"><Icon name="heart" size={17} /></button><div className="post-preview-dots">{gallery.slice(0, 4).map((_, index) => <i className={index === 0 ? 'is-active' : ''} key={index} />)}</div></div><div className="post-preview-content"><span className="post-preview-type">{propertyType} · Verified after review</span><h3>{listingTitle}</h3><p><Icon name="pin" size={13} /> {address || 'Your neighbourhood'}, {location}</p><strong>RWF {price || '0'} <small>{intent === 'For rent' ? '/ month' : 'asking'}</small></strong><div className="post-preview-stats"><span>{isLand ? area : bedrooms}<small>{isLand ? 'm²' : 'beds'}</small></span><span>{isLand ? 'Freehold' : bathrooms}<small>{isLand ? 'tenure' : 'baths'}</small></span><span>{isLand ? 'Road ready' : area}<small>{isLand ? '' : 'm²'}</small></span></div></div></article><p className="post-preview-note"><Icon name="sparkles" size={14} /> Your draft stays private until you publish it.</p></aside></div>
      </section>
    </div>
  </main>;
}
