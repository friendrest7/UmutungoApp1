'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ChangeEvent, useEffect, useState } from 'react';
import { AuthModal } from './AuthModal';
import { Icon } from './Icons';
import { InterfacePreferences } from './InterfacePreferences';
import { Logo } from './Logo';
import { t } from '../data/translations';
import { getDistrictNames, getSectorNames, provinceNames } from '../data/rwandaLocations';
import { usePersistentLanguage } from '../lib/language';
import { apiToken, uploadListingImage, umutungoApi } from '../lib/umutungoApi';

type PropertyType = 'House' | 'Apartment' | 'Land' | 'Commercial' | 'Office' | 'Hospitality' | 'Vehicle' | 'Furniture' | 'Appliance' | 'Equipment' | 'Other';
type PostingRole = 'Komisiyoneri' | 'Landlord' | 'Property Owner';
type Intent = 'For rent' | 'For sale' | 'For sale or rent' | 'For lease' | 'For sale or lease' | 'For hire' | 'Book a stay';
type TransactionType = 'rent_out' | 'sell' | 'both' | 'book';
type IntentOption = { label: Intent; transactionType: TransactionType };

function parseCoordinates(value: string) {
  const decoded = value.replaceAll('%2C', ',').replaceAll('%2c', ',');
  const match = decoded.match(/(?:@|!3d)(-?\d{1,3}(?:\.\d+)?)(?:,|!4d|\/|\s)+(-?\d{1,3}(?:\.\d+)?)/) ?? decoded.match(/(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (!match) return null;
  const latitude = Number(match[1]); const longitude = Number(match[2]);
  return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : null;
}

function getIntentOptions(type: PropertyType): IntentOption[] {
  if (type === 'Other' || type === 'Furniture' || type === 'Appliance') return [{ label: 'For sale', transactionType: 'sell' }];
  if (type === 'Land') return [{ label: 'For sale', transactionType: 'sell' }, { label: 'For lease', transactionType: 'rent_out' }, { label: 'For sale or lease', transactionType: 'both' }];
  if (type === 'Hospitality') return [{ label: 'Book a stay', transactionType: 'book' }, { label: 'For sale', transactionType: 'sell' }];
  if (type === 'Vehicle') return [{ label: 'For hire', transactionType: 'rent_out' }, { label: 'For sale', transactionType: 'sell' }];
  return [{ label: 'For sale', transactionType: 'sell' }, { label: 'For rent', transactionType: 'rent_out' }, { label: 'For sale or rent', transactionType: 'both' }];
}

const steps = [
  { number: 1, label: 'Property story', note: 'What are you offering?' },
  { number: 2, label: 'Place & details', note: 'Help people find it.' },
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

const amenityOptions = ['Parking', 'Garden', 'Furnished', 'Security', 'Water tank', 'Internet ready'];
const assetHighlightOptions = ['Delivery available', 'Assembly available', 'Warranty', 'Negotiable'];
const vehicleHighlightOptions = ['Air conditioning', 'Automatic transmission', 'Four wheel drive', 'Insurance included'];
const landHighlightOptions = ['Utilities nearby', 'Survey available', 'Title ready', 'Road access'];

function RwandaLocationFields({ province, onProvinceChange, district, districtOptions, onDistrictChange, sector, sectorOptions, onSectorChange, cell, cellOptions, onCellChange, village, villageOptions, onVillageChange, loading, error, gpsPin, onCaptureGps }: { province: string; onProvinceChange: (value: string) => void; district: string; districtOptions: string[]; onDistrictChange: (value: string) => void; sector: string; sectorOptions: string[]; onSectorChange: (value: string) => void; cell: string; cellOptions: string[]; onCellChange: (value: string) => void; village: string; villageOptions: string[]; onVillageChange: (value: string) => void; loading: boolean; error: string; gpsPin: string; onCaptureGps: () => void }) {
  return <><div className="post-location-hierarchy"><label className="post-field"><span>Province</span><select value={province} onChange={(event) => onProvinceChange(event.target.value)}>{provinceNames.map((item) => <option key={item}>{item}</option>)}</select></label><label className="post-field"><span>District</span><select value={district} onChange={(event) => onDistrictChange(event.target.value)} disabled={!districtOptions.length}>{districtOptions.map((item) => <option key={item}>{item}</option>)}</select></label><label className="post-field"><span>Sector</span><select value={sector} onChange={(event) => onSectorChange(event.target.value)} disabled={loading || !sectorOptions.length}><option value="">{loading ? 'Loading sectorsÃ¢â‚¬Â¦' : 'Select sector'}</option>{sectorOptions.map((item) => <option key={item}>{item}</option>)}</select></label><label className="post-field"><span>Cell <small>Optional</small></span><input list="rwanda-cell-options" value={cell} onChange={(event) => onCellChange(event.target.value)} placeholder="Enter or choose a cell" /><datalist id="rwanda-cell-options">{cellOptions.map((item) => <option key={item} value={item} />)}</datalist></label><label className="post-field"><span>Village <small>Optional</small></span><input list="rwanda-village-options" value={village} onChange={(event) => onVillageChange(event.target.value)} placeholder="Enter or choose a village" /><datalist id="rwanda-village-options">{villageOptions.map((item) => <option key={item} value={item} />)}</datalist></label></div>{error && <p className="post-location-error" role="alert">{error}</p>}<div className="post-location-tools"><button className="post-secondary-button" type="button" onClick={onCaptureGps}><Icon name="pin" size={14} /> {gpsPin ? 'GPS pin saved' : 'Use current location'}</button>{gpsPin && <small>{gpsPin}</small>}</div></>;
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
  status: 'Draft' | 'Scheduled' | 'Published';
  scheduledFor?: string;
  expiresAt?: string;
  savedAt: string;
};

function PostingSelection({ role, category, signedInRole, onRoleChange, onCategoryChange, onContinue, error }: { role: PostingRole | null; category: PropertyType; signedInRole: 'Landlord' | 'Property Owner' | 'Commissioner / Komisiyoneri' | null; onRoleChange: (value: PostingRole | null) => void; onCategoryChange: (value: PropertyType) => void; onContinue: () => void; error: string }) {
  const { language } = usePersistentLanguage();
  const roleOptions: PostingRole[] = signedInRole === 'Commissioner / Komisiyoneri'
    ? ['Komisiyoneri']
    : signedInRole === 'Landlord' || signedInRole === 'Property Owner'
      ? [signedInRole]
      : ['Komisiyoneri', 'Landlord', 'Property Owner'];
  const isRoleLocked = signedInRole !== null;
  return <main className="posting-selection-page"><header className="post-property-header"><Link href="/" aria-label="Umutungo home"><Logo /></Link><InterfacePreferences /><Link className="post-home-link" href="/"><Icon name="x" size={14} /> {t(language, 'Exit')}</Link></header><section className="posting-selection-shell"><div className="posting-selection-intro"><h1>{isRoleLocked ? <>{t(language, 'Post as')}<br /><em>{t(language, roleOptions[0])}.</em></> : <>{t(language, 'Choose a role')}<br /><em className="posting-selection-continue">{t(language, 'to continue.')}</em></>}</h1><p className="posting-selection-description">{t(language, 'Choose the type of property you want to upload and the role you want to post as. Weâ€™ll give you tools to manage your listings and a platform experience tailored to your needs and premium level.')}</p><p className="posting-selection-description">{t(language, 'Weâ€™re happy to help you find a market for your property. Everything you need to promote it is on our platform.')}</p><p className="posting-selection-description">{t(language, 'We help everyone bring their offerings to market and reach people beyond their usual reach in milliseconds.')}</p></div><div className="posting-selection-card"><div className="posting-selection-card-heading"><div><span>{t(language, 'STEP 1 OF 2')}</span><h2>{t(language, 'Set the direction')}</h2></div></div><fieldset><legend>{t(language, isRoleLocked ? 'Your posting role' : 'Who are you posting as?')}</legend><div className={`posting-role-grid ${isRoleLocked ? 'posting-role-locked' : ''}`}>{roleOptions.map((item) => <button type="button" key={item} className={role === item ? 'is-selected' : ''} aria-pressed={role === item} onClick={() => isRoleLocked ? undefined : onRoleChange(role === item ? null : item)}><strong>{t(language, item)}</strong><small>{t(language, item === 'Komisiyoneri' ? 'List properties for clients.' : item === 'Landlord' ? 'Manage rental listings and tenants.' : 'Manage your property listings.')}</small></button>)}</div></fieldset><fieldset><legend>{t(language, 'What are you listing?')}</legend><div className="posting-category-grid">{typeOptions.map((item) => <button type="button" key={item.key} className={category === item.key ? 'is-selected' : ''} onClick={() => onCategoryChange(item.key)}><Icon name={item.icon} size={18} /><span>{t(language, item.label)}</span></button>)}</div></fieldset>{error && <p className="post-location-error" role="alert">{t(language, error)}</p>}<button className="post-primary-button" type="button" onClick={onContinue}>{t(language, 'Continue to listing form')} <Icon name="arrow" size={15} /></button></div></section></main>;
}

function ListingPricingFields({ price, onPriceChange, priceLabel, priceNote, quote = null, quoteStatus = 'idle' }: { price: string; onPriceChange: (value: string) => void; priceLabel: string; priceNote: string; quote?: { fee: number; rate_percent: number } | null; quoteStatus?: 'idle' | 'loading' | 'ready' | 'error' }) {
  return <section className="post-pricing-panel" aria-label="Listing price and one-time upload fee">
    <div className="post-pricing-heading"><strong>Price and one-time upload fee</strong><p>Enter the product price to see the one-time fee for uploading this listing.</p></div>
    <div className="post-price-field"><label className="post-field"><span>{priceLabel}</span><div className="post-input-prefix"><b>RWF</b><input value={price} onChange={(event) => onPriceChange(event.target.value)} inputMode="numeric" /></div></label><span className="post-price-note">{priceNote}</span></div>
    <div className="post-monthly-fee" aria-live="polite"><span>One-time listing upload fee</span><strong>{quote ? `RWF ${quote.fee.toLocaleString('en-RW')}` : quoteStatus === 'loading' ? 'Calculating…' : quoteStatus === 'error' ? 'Fee unavailable' : 'Enter a price'}</strong><p>{quote ? `Paid once per property upload. Calculated at ${quote.rate_percent}% of the entered price.` : quoteStatus === 'error' ? 'Could not get the current posting rate. Try changing the price or check your connection.' : 'The current posting rate will be checked automatically.'}</p></div>
  </section>;
}
export function PostPropertyComposer({ embedded = false, onCancel }: { embedded?: boolean; onCancel?: () => void }) {
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
  const [publicationMode, setPublicationMode] = useState<'Publish now' | 'Draft' | 'Scheduled'>('Publish now');
  const [scheduledFor, setScheduledFor] = useState('');
  const [ownerTier, setOwnerTier] = useState('Silver Ã‚Â· 90 days');
  const [address, setAddress] = useState('');
  const [price, setPrice] = useState('1,250,000');
  const [paymentMethod, setPaymentMethod] = useState<'mobilemoneyrwanda' | 'card'>('mobilemoneyrwanda');
  const [paymentEmail, setPaymentEmail] = useState('');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [paymentPanelOpen, setPaymentPanelOpen] = useState(false);
  const [bedrooms, setBedrooms] = useState('4');
  const [bathrooms, setBathrooms] = useState('3');
  const [area, setArea] = useState('220');
  const [assetQuantity, setAssetQuantity] = useState('1');
  const [assetCondition, setAssetCondition] = useState('Good');
  const [assetSpecifications, setAssetSpecifications] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleMileage, setVehicleMileage] = useState('');
  const [vehicleCondition, setVehicleCondition] = useState('Good');
  const [landTenure, setLandTenure] = useState('Freehold');
  const [landRoadAccess, setLandRoadAccess] = useState('Yes');
  const [amenities, setAmenities] = useState<string[]>(['Parking', 'Security']);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [selectedCover, setSelectedCover] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [paymentPending, setPaymentPending] = useState(false);
  const [savedListingStatus, setSavedListingStatus] = useState('draft');
  const [accessRole, setAccessRole] = useState<'Landlord' | 'Property Owner' | 'Commissioner / Komisiyoneri' | null>(null);
  const [postingRole, setPostingRole] = useState<PostingRole | null>(null);
  const [selectionComplete, setSelectionComplete] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [saveError, setSaveError] = useState('');
  const [feeQuote, setFeeQuote] = useState<{ fee: number; rate_percent: number; demo_mode?: boolean } | null>(null);
  const [feeQuoteStatus, setFeeQuoteStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [demoPaymentSucceeded, setDemoPaymentSucceeded] = useState(false);

  useEffect(() => {
    const amount = Number(price.replace(/[^0-9.]/g, '')) || 0;
    if (!selectionComplete || !accessRole || amount <= 0) { setFeeQuote(null); setFeeQuoteStatus('idle'); return; }
    if (!apiToken()) { setFeeQuote(null); setFeeQuoteStatus('error'); return; }
    const controller = new AbortController();
    setFeeQuote(null);
    setFeeQuoteStatus('loading');
    const timer = window.setTimeout(() => {
      void umutungoApi<{ fee: number; rate_percent: number }>(`/api/v1/listing-fee?price=${encodeURIComponent(String(amount))}`, { signal: controller.signal })
        .then((quote) => { if (quote) { setFeeQuote(quote); setFeeQuoteStatus('ready'); } else { setFeeQuote(null); setFeeQuoteStatus('error'); } })
        .catch(() => { if (!controller.signal.aborted) { setFeeQuote(null); setFeeQuoteStatus('error'); } });
    }, 150);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [price, selectionComplete, accessRole]);

  const gallery = uploadedImages.length ? uploadedImages : curatedImages[propertyType];
  const cover = selectedCover ?? gallery[0];
  const listingTitle = title.trim();
  const isLand = propertyType === 'Land';
  const isAsset = ['Vehicle', 'Furniture', 'Appliance', 'Equipment', 'Other'].includes(propertyType);
  const isAccommodation = ['House', 'Apartment', 'Hospitality'].includes(propertyType);
  const highlightOptions = propertyType === 'Vehicle' ? vehicleHighlightOptions : isAsset ? assetHighlightOptions : isLand ? landHighlightOptions : amenityOptions;
  const intentOptions = getIntentOptions(propertyType);
  const selectedIntent = intentOptions.find((option) => option.label === intent) ?? intentOptions[0];
  const districtOptions = getDistrictNames(location);
  const priceLabel = selectedIntent.transactionType === 'both' ? propertyType === 'Land' ? 'Sale or lease price' : 'Sale or rent price' : selectedIntent.transactionType === 'sell' ? 'Asking price' : propertyType === 'Hospitality' ? 'Nightly rate' : propertyType === 'Vehicle' || propertyType === 'Equipment' ? 'Hire price' : propertyType === 'Land' ? 'Lease price' : 'Monthly price';
  const priceNote = selectedIntent.transactionType === 'both' ? 'Enter the price for either option' : selectedIntent.transactionType === 'sell' ? 'total asking price' : propertyType === 'Hospitality' ? 'per night' : propertyType === 'Vehicle' || propertyType === 'Equipment' ? 'per day' : propertyType === 'Land' ? 'lease terms' : 'per month';

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
    const syncAccount = () => {
      try {
      const user = JSON.parse(window.localStorage.getItem('umutungo-demo-user') ?? 'null') as { role?: string } | null;
      const userRole = user?.role;
      setAccessRole(userRole === 'Landlord' || userRole === 'Property Owner' || userRole === 'Commissioner / Komisiyoneri' ? userRole : null);
      if (userRole === 'Landlord' || userRole === 'Property Owner' || userRole === 'Commissioner / Komisiyoneri') {
        setPostingRole(userRole === 'Commissioner / Komisiyoneri' ? 'Komisiyoneri' : userRole);
        setSelectionComplete(true);
      }
      } catch {
        setAccessRole(null);
      } finally {
        setCheckingAccess(false);
      }
    };
    syncAccount();
    window.addEventListener('umutungo:auth-changed', syncAccount);
    window.addEventListener('storage', syncAccount);
    return () => {
      window.removeEventListener('umutungo:auth-changed', syncAccount);
      window.removeEventListener('storage', syncAccount);
    };
  }, []);

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
    setUploadFiles(files.slice(0, 6));
    setSelectedCover(null);
  };

  const toggleAmenity = (amenity: string) => setAmenities((current) => current.includes(amenity) ? current.filter((item) => item !== amenity) : [...current, amenity]);
  const continueToForm = () => {
    if (!postingRole) { setSaveError('Choose a posting role before continuing.'); return; }
    setSaveError('');
    setSelectionComplete(true);
  };
  const next = () => {
    if (step === 1 && !title.trim()) { setSaveError('Enter a listing title before continuing.'); return; }
    if (step === 1 && !validateListingPrice()) return;
    setSaveError('');
    setStep((current) => Math.min(3, current + 1));
  };
  const validateListingPrice = () => {
    const amount = Number(price.replace(/[^0-9.]/g, '')) || 0;
    if (amount <= 0) { setSaveError('Enter a listing price greater than RWF 0.'); return false; }
    return true;
  };
  const previous = () => setStep((current) => Math.max(1, current - 1));
  const saveListingNow = async (saveForLater = false) => {
    if (!title.trim()) { setSaveError('Enter a listing title before saving.'); setStep(1); return; }
    if (!validateListingPrice()) { setStep(2); return; }
    const desiredStatus = saveForLater || publicationMode === 'Draft' ? 'draft' : publicationMode === 'Scheduled' ? 'scheduled' : 'published';
    if (desiredStatus !== 'draft' && !/^\S+@\S+\.\S+$/.test(paymentEmail.trim())) { setSaveError('Enter an email address to receive your payment receipt.'); setStep(1); return; }
    if (desiredStatus !== 'draft' && paymentMethod === 'mobilemoneyrwanda' && !feeQuote?.demo_mode && !/^\+?2507\d{8}$/.test(paymentPhone.replace(/[\s()-]/g, '').replace(/^07/, '+2507'))) { setSaveError('Enter a valid Rwanda phone number for mobile money, such as +250 78 123 4567.'); setStep(1); return; }
    if (!district || !sector) { setLocationError('Choose a valid district and sector before saving the listing.'); setStep(2); return; }
    if (publicationMode === 'Scheduled' && (!scheduledFor || new Date(scheduledFor).getTime() <= Date.now())) { setSaveError('Choose a future date and time for scheduled publication.'); setStep(3); return; }
    if (!apiToken()) { setSelectionComplete(false); setAuthOpen(true); setSaveError('Sign in with a posting account before publishing.'); return; }
    if (accessRole) {
      const roleMatches = (postingRole === 'Komisiyoneri' && accessRole === 'Commissioner / Komisiyoneri') || (postingRole !== 'Komisiyoneri' && (accessRole === 'Landlord' || accessRole === 'Property Owner'));
      if (!roleMatches) { setSelectionComplete(false); setAuthOpen(true); setSaveError(`Use an account that matches your selected posting role: ${postingRole}.`); return; }
    }
    const expiryDays = accessRole === 'Commissioner / Komisiyoneri' ? 30 : ownerTier.startsWith('Silver') ? 90 : ownerTier.startsWith('Gold') ? 180 : 365;
    setSaveError('');
    const amount = Number(price.replace(/[^0-9.]/g, '')) || 0;
    let databaseListing: { id: string; status: string; expires_at?: string } | null = null;
    let persistedImages: string[] = [];
    try {
      let photoFiles = uploadFiles;
      if (!photoFiles.length) {
        const photoResponse = await fetch(cover);
        if (!photoResponse.ok) throw new Error('Choose a property photo before saving this listing.');
        const photoBlob = await photoResponse.blob();
        const filename = cover.split('/').pop() || 'property-cover.jpg';
        photoFiles = [new File([photoBlob], filename, { type: photoBlob.type || 'image/jpeg' })];
      }
      databaseListing = await umutungoApi<{ id: string; status: string; expires_at?: string }>('/api/v1/listings', {
        method: 'POST',
        body: JSON.stringify({
          category: propertyType.toLowerCase(),
          transaction_type: selectedIntent.transactionType,
          title: listingTitle,
          description,
          price: amount,
          currency: 'RWF',
          province: location,
          district,
          sector,
          cell,
          village,
          latitude: parseCoordinates(gpsPin)?.latitude ?? null,
          longitude: parseCoordinates(gpsPin)?.longitude ?? null,
          publish_at: !saveForLater && publicationMode === 'Scheduled' && scheduledFor ? new Date(scheduledFor).toISOString() : null,
          status: 'draft',
          tags: amenities,
          amenities,
          contact_method: 'message',
          media: [],
          measurements: propertyType === 'Vehicle'
            ? { make: vehicleMake, model: vehicleModel, year: Number(vehicleYear) || 0, mileage_km: Number(vehicleMileage) || 0, condition: vehicleCondition }
            : isAsset
            ? { quantity: Number(assetQuantity) || 1, condition: assetCondition, specifications: assetSpecifications }
            : isLand
              ? { plot_size: Number(area) || 0, tenure: landTenure, road_access: landRoadAccess }
              : { building_size: Number(area) || 0, bedrooms: Number(bedrooms) || 0, bathrooms: Number(bathrooms) || 0, parking: amenities.includes('Parking') ? 1 : 0 },
        }),
      });
      if (!databaseListing?.id) throw new Error('The server did not return a saved listing.');
      for (const file of photoFiles) {
        const media = await uploadListingImage(databaseListing.id, file);
        persistedImages.push(media.url);
      }
      if (desiredStatus !== 'draft') {
        try {
          const entitlement = await umutungoApi<{ status: string }>(`/api/v1/listings/${encodeURIComponent(databaseListing.id)}/publish`, { method: 'POST', body: JSON.stringify({ requested_status: desiredStatus, publish_at: desiredStatus === 'scheduled' && scheduledFor ? new Date(scheduledFor).toISOString() : null }) });
          if (entitlement?.status === 'published' || entitlement?.status === 'scheduled') databaseListing.status = entitlement.status;
          else if (!entitlement) throw new Error('Sign in again before publishing this listing.');
        } catch (error) {
          if (!(error instanceof Error) || !error.message.toLowerCase().includes('payment required')) throw error;
        }
        if (databaseListing.status !== 'published' && databaseListing.status !== 'scheduled') {
        if (feeQuote?.demo_mode) {
          const demoPayment = await umutungoApi<{ status: string; is_demo: boolean; message: string }>(`/api/v1/listings/${encodeURIComponent(databaseListing.id)}/demo-payment`, {
            method: 'POST',
            body: JSON.stringify({ email: paymentEmail.trim(), requested_status: desiredStatus, publish_at: publicationMode === 'Scheduled' && scheduledFor ? new Date(scheduledFor).toISOString() : null }),
          });
          if (demoPayment?.status !== 'successful' || !demoPayment.is_demo) throw new Error('Demo payment could not be completed. Your listing is still saved as a draft.');
          databaseListing.status = desiredStatus;
          setDemoPaymentSucceeded(true);
        } else {
        const checkout = await umutungoApi<{ checkout_url: string }>(`/api/v1/listings/${encodeURIComponent(databaseListing.id)}/subscription-payment`, {
          method: 'POST',
          body: JSON.stringify({ payment_method: paymentMethod, email: paymentEmail.trim(), phone: paymentPhone.trim(), requested_status: desiredStatus, publish_at: publicationMode === 'Scheduled' && scheduledFor ? new Date(scheduledFor).toISOString() : null }),
        });
        if (!checkout?.checkout_url) throw new Error('Could not start the secure listing fee checkout. Your listing is saved as a draft.');
        setPaymentPanelOpen(false);
        setPaymentPending(true);
        window.setTimeout(() => window.location.assign(checkout.checkout_url), 700);
        return;
        }
        }
      }
    } catch (error) {
      setPaymentPending(false);
      setSaveError(error instanceof Error ? error.message : 'The listing could not be saved. Please try again.');
      return;
    }
    const listing: LandlordListing = { id: databaseListing.id, title: listingTitle, type: propertyType, intent, location: `${address || sector}, ${district}, ${location}`, province: location, district, sector, cell, village, gpsPin, price: `RWF ${price || '0'}`, priceNote: selectedIntent.transactionType === 'both' ? propertyType === 'Land' ? ' sale or lease' : ' sale or rent' : selectedIntent.transactionType === 'sell' ? ' asking' : propertyType === 'Hospitality' ? ' / night' : propertyType === 'Vehicle' || propertyType === 'Equipment' ? ' / day' : propertyType === 'Land' ? ' lease price' : ' / month', cover: persistedImages[0] ?? cover, images: persistedImages.length ? persistedImages : gallery, bedrooms: propertyType === 'Vehicle' ? `${vehicleMake} ${vehicleModel}`.trim() || vehicleYear : isAsset ? assetQuantity : isLand ? landTenure : bedrooms, bathrooms: propertyType === 'Vehicle' ? vehicleCondition : isAsset ? assetCondition : isLand ? landRoadAccess : bathrooms, area: propertyType === 'Vehicle' ? vehicleMileage : isAsset ? assetSpecifications : area, amenities, status: databaseListing.status === 'scheduled' ? 'Scheduled' : databaseListing.status === 'published' ? 'Published' : 'Draft', savedAt: new Date().toISOString(), scheduledFor: scheduledFor || undefined, expiresAt: databaseListing.expires_at ?? new Date(Date.now() + expiryDays * 86400000).toISOString() };
    const storageKey = accessRole === 'Commissioner / Komisiyoneri' ? 'umutungo-commissioner-properties' : 'umutungo-landlord-properties';
    try {
      const existing = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]') as LandlordListing[];
      window.localStorage.setItem(storageKey, JSON.stringify([listing, ...existing]));
    } catch {
      window.localStorage.setItem(storageKey, JSON.stringify([listing]));
    }
    setSavedListingStatus(databaseListing.status);
    setPublished(true);
  };

  const saveListing = async () => {
    if (publicationMode === 'Draft') {
      await saveListingNow();
      return;
    }
    setSaveError('');
    setPaymentPanelOpen(true);
  };

  const Container = embedded ? 'section' : 'main';
  if (checkingAccess) return <Container className={embedded ? "post-property-page post-property-embedded" : "post-property-page"}><p>Loading listing form...</p></Container>;
  if (!selectionComplete) return <><PostingSelection role={postingRole} category={propertyType} signedInRole={accessRole} onRoleChange={(value) => { setPostingRole(value); setSaveError(''); }} onCategoryChange={(value) => { setPropertyType(value); setSaveError(''); }} onContinue={continueToForm} error={saveError} /><AuthModal open={authOpen} role={postingRole === 'Komisiyoneri' ? 'Commissioner / Komisiyoneri' : postingRole === 'Landlord' ? 'Landlord' : postingRole === 'Property Owner' ? 'Property Owner' : undefined} onClose={() => setAuthOpen(false)} onSuccess={(accountRole) => { const nextRole = accountRole === 'Commissioner / Komisiyoneri' ? 'Komisiyoneri' : accountRole === 'Property Owner' ? 'Property Owner' : accountRole === 'Landlord' ? 'Landlord' : null; if (nextRole) { setAccessRole(accountRole as 'Landlord' | 'Property Owner' | 'Commissioner / Komisiyoneri'); setPostingRole((current) => current ?? nextRole); setSelectionComplete(true); setSaveError(''); setAuthOpen(false); } else setSaveError('A Komisiyoneri, Landlord, or Property Owner account is required to post a listing.'); }} /></>;

  if (paymentPending) return <Container className={embedded ? "post-property-page post-property-embedded" : "post-property-page"}><section className="post-success payment-pending-state"><div className="post-success-mark"><Icon name="creditCard" size={27} /></div><p className="post-eyebrow">Payment pending</p><h1>Opening secure<br /><em>payment checkout.</em></h1><p>Your listing is saved as a draft while you complete payment.</p></section></Container>;

  if (published) {
    return <Container className={embedded ? "post-property-page post-property-embedded" : "post-property-page"}>{!embedded && <header className="post-property-header"><Link href="/" aria-label="Umutungo home"><Logo /></Link><InterfacePreferences /><div className="post-header-links"><Link className="post-home-link" href="/"><Icon name="home" size={14} /> Home</Link><Link className="post-exit-link" href="/"><Icon name="x" size={14} /> Exit builder</Link></div></header>}<section className="post-success"><div className="post-success-mark"><Icon name="check" size={30} /></div><p className="post-eyebrow">{demoPaymentSucceeded ? 'Demo payment successful' : 'Listing saved'}</p><h1>{demoPaymentSucceeded ? <>Payment complete<br /><em>demo continues.</em></> : <>Your place is ready<br /><em>for its next chapter.</em></>}</h1><p>{demoPaymentSucceeded ? 'This was a test payment only. No money was charged.' : savedListingStatus === 'scheduled' ? 'Scheduled listing saved.' : savedListingStatus === 'published' ? 'Listing is published and available in the marketplace.' : 'Private draft saved.'}</p><div className="post-success-actions">{embedded ? <button className="post-primary-button" type="button" onClick={onCancel}>Back to landlord dashboard</button> : <Link className="post-primary-button" href={accessRole === 'Commissioner / Komisiyoneri' ? '/commissioner' : '/property-owner'}>Open dashboard <Icon name="arrow" size={15} /></Link>}<button className="post-secondary-button" type="button" onClick={() => setPublished(false)}>Edit listing</button></div></section></Container>;
  }

  return <Container className={embedded ? "post-property-page post-property-embedded" : "post-property-page"}>
    {!embedded && <header className="post-property-header"><div className="post-header-brand"><Link href="/" aria-label="Umutungo home"><Logo /></Link><span>NEW LISTING</span></div><div className="post-header-center"><span className="post-live-dot" /> Draft autosaved</div><div className="post-header-actions"><InterfacePreferences /><nav className="post-header-links" aria-label="Listing builder navigation"><Link className="post-home-link" href="/"><Icon name="home" size={14} /><span>Home</span></Link><Link className="post-exit-link" href="/"><Icon name="x" size={14} /><span>Exit builder</span></Link></nav></div></header>}
    {embedded && <button className="post-embedded-back" type="button" onClick={onCancel}><Icon name="arrow" size={14} /> Back to overview</button>}
    <div className="post-property-layout">
      <aside className="post-property-sidebar"><div><p className="post-eyebrow">New listing</p><h1>List your<br /><em>property.</em></h1><p className="post-sidebar-copy">Share the details buyers, renters, and clients need.</p></div><nav className="post-progress" aria-label="Listing steps">{steps.map((item) => <button className={step === item.number ? 'is-active' : step > item.number ? 'is-complete' : ''} type="button" key={item.number} onClick={() => setStep(item.number)}><span className="post-step-number">{step > item.number ? <Icon name="check" size={13} /> : `0${item.number}`}</span><span><strong>{item.label}</strong><small>{item.note}</small></span></button>)}</nav></aside>
      <section className="post-property-main">{saveError && <p className="post-save-error" role="alert">{saveError}</p>}
        <div className="post-main-heading"><div><p className="post-eyebrow">Step 0{step} of 03</p><h2>{steps[step - 1].label}</h2></div><span className="post-save-status"><Icon name="check" size={13} /> Saved locally</span></div>
        <div className="post-builder-grid"><div className="post-form-card">{step === 2 && <RwandaLocationFields province={location} onProvinceChange={(value) => { setLocation(value); setLocationError(''); }} district={district} districtOptions={districtOptions} onDistrictChange={(value) => { setDistrict(value); setSector(''); setCell(''); setVillage(''); }} sector={sector} sectorOptions={locationOptions} onSectorChange={(value) => { setSector(value); setCell(''); setVillage(''); }} cell={cell} cellOptions={cellOptions} onCellChange={(value) => { setCell(value); setVillage(''); }} village={village} villageOptions={villageOptions} onVillageChange={setVillage} loading={locationLoading} error={locationError} gpsPin={gpsPin} onCaptureGps={() => navigator.geolocation?.getCurrentPosition((position) => { const pin = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`; setGpsPin(pin); setLocationError(''); }, () => setLocationError('Location access was not available. You can continue with the administrative location.'))} />}
          {step === 1 && <div className="post-form-section"><div className="post-section-intro"><h3>Listing details</h3></div><label className="post-field"><span>Property</span><select value={propertyType} onChange={(event) => { const nextType = event.target.value as PropertyType; setPropertyType(nextType); if (!getIntentOptions(nextType).some((option) => option.label === intent)) setIntent(getIntentOptions(nextType)[0].label); setAmenities(['Vehicle', 'Furniture', 'Appliance', 'Equipment', 'Other'].includes(nextType) || nextType === 'Land' ? [] : ['Parking', 'Security']); }} aria-label="Property">{typeOptions.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label><div className="post-field-group"><span className="post-field-label">Listing intent</span><div className="post-segmented" role="group" aria-label="Listing intent">{intentOptions.map((option) => <button className={intent === option.label ? 'is-selected' : ''} type="button" key={option.label} onClick={() => setIntent(option.label)}>{option.label}</button>)}</div></div><ListingPricingFields price={price} onPriceChange={(value) => { setPrice(value); setSaveError(''); }} priceLabel={priceLabel} priceNote={priceNote} quote={feeQuote} quoteStatus={feeQuoteStatus} /><label className="post-field"><span>Listing Title</span><input value={title} onChange={(event) => { setTitle(event.target.value); setSaveError(''); }} placeholder="Enter a listing title" required /></label><label className="post-field"><span>Short description <small>Optional</small></span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the property and its features." rows={4} /></label></div>}
          {step === 2 && <div className="post-form-section">
            {isAsset && <div className="post-section-intro"><h3>Set the collection area and item details</h3><p>Add a general area for pickup, then describe the item.</p></div>}
            {isAsset ? <label className="post-field"><span>Pickup area <small>Optional</small></span><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="e.g. Kimihurura, Kigali" /></label> : <label className="post-field"><span>{isLand ? 'Area or nearby landmark' : 'Neighbourhood'}</span><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder={isLand ? 'e.g. near the main road' : 'e.g. Kacyiru, near the offices'} /></label>}
            <div className="post-form-grid post-stats-grid">
              {isAsset ? <>
                <label className="post-field"><span>Quantity</span><div className="post-input-suffix"><input value={assetQuantity} onChange={(event) => setAssetQuantity(event.target.value)} inputMode="numeric" /><b>items</b></div></label>
                <label className="post-field"><span>Condition</span><select value={assetCondition} onChange={(event) => setAssetCondition(event.target.value)}><option>New</option><option>Like new</option><option>Good</option><option>Fair</option><option>Needs repair</option></select></label>
                <label className="post-field"><span>Specifications <small>Optional</small></span><input value={assetSpecifications} onChange={(event) => setAssetSpecifications(event.target.value)} placeholder="e.g. wooden, 6 seats" /></label>
              </> : isLand ? <>
                <label className="post-field"><span>Plot size</span><div className="post-input-suffix"><input value={area} onChange={(event) => setArea(event.target.value)} inputMode="numeric" /><b>mÃ‚Â²</b></div></label>
                <label className="post-field"><span>Tenure</span><select value={landTenure} onChange={(event) => setLandTenure(event.target.value)}><option>Freehold</option><option>Leasehold</option><option>Customary</option><option>Other</option></select></label>
                <label className="post-field"><span>Road access</span><select value={landRoadAccess} onChange={(event) => setLandRoadAccess(event.target.value)}><option>Yes</option><option>No</option><option>Nearby</option></select></label>
              </> : <>
                <label className="post-field"><span>Bedrooms</span><div className="post-input-suffix"><input value={bedrooms} onChange={(event) => setBedrooms(event.target.value)} inputMode="numeric" /><b>beds</b></div></label>
                <label className="post-field"><span>Bathrooms</span><div className="post-input-suffix"><input value={bathrooms} onChange={(event) => setBathrooms(event.target.value)} inputMode="numeric" /><b>baths</b></div></label>
                <label className="post-field"><span>Floor area</span><div className="post-input-suffix"><input value={area} onChange={(event) => setArea(event.target.value)} inputMode="numeric" /><b>mÃ‚Â²</b></div></label>
              </>}
            </div>
            <div className="post-field-group"><span className="post-field-label">Highlights</span><div className="post-amenities">{highlightOptions.map((amenity) => <button className={amenities.includes(amenity) ? 'is-selected' : ''} type="button" key={amenity} onClick={() => toggleAmenity(amenity)}>{amenities.includes(amenity) && <Icon name="check" size={12} />}{amenity}</button>)}</div></div>
          </div>}
          {step === 3 && <div className="post-form-section"><div className="post-section-intro"><h3>Let the photos do some talking</h3><p>Choose a cover that sets the mood, then add the details that help someone picture themselves there.</p></div><label className="post-dropzone"><input type="file" accept="image/*" multiple onChange={handleFiles} /><span className="post-upload-icon"><Icon name="download" size={19} /></span><strong>Drop your photos here</strong><small>or click to browse Ã‚Â· JPG, PNG up to 10MB each</small></label><div className="post-curated-heading"><span>Start with a curated set</span><small>Swap these for your own any time</small></div><div className="post-image-choices">{curatedImages[propertyType].map((image) => <button className={cover === image ? 'is-selected' : ''} type="button" key={image} onClick={() => { setSelectedCover(image); setUploadedImages([]); setUploadFiles([]); }}><Image src={image} alt="Suggested property view" fill sizes="120px" />{cover === image && <span><Icon name="check" size={13} /></span>}</button>)}</div><div className="post-amenities-summary"><span>Selected highlights</span><div>{amenities.length ? amenities.map((amenity) => <b key={amenity}>{amenity}</b>) : <small>Add a few highlights above</small>}</div></div></div>}
          {step === 3 && <div className="post-lifecycle-panel"><div><span className="post-field-label">Publication</span><p>Pay now to publish your listing, or save it as a private draft and pay when you’re ready. You can also schedule publication.</p></div><div className="post-segmented"><button className={publicationMode === "Draft" ? "is-selected" : ""} type="button" onClick={() => setPublicationMode((current) => current === 'Draft' ? 'Publish now' : 'Draft')}>Save as draft</button><button className={publicationMode === "Scheduled" ? "is-selected" : ""} type="button" onClick={() => setPublicationMode((current) => current === 'Scheduled' ? 'Publish now' : 'Scheduled')}>Schedule</button></div>{publicationMode === 'Scheduled' && <label className="post-field"><span>Publish date and time</span><input type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} required /></label>}{(accessRole === 'Landlord' || accessRole === 'Property Owner') && <div className="owner-premium-plans"><span className="post-field-label">Property Owner premium plan</span><div>{(['Silver', 'Gold', 'Platinum'] as const).map((plan) => <button className={ownerTier.startsWith(plan) ? 'is-selected' : ''} type="button" key={plan} onClick={() => setOwnerTier(plan)}><img src={`/premium/${plan.toLowerCase()}.svg`} alt={`${plan} premium plan icon`} /><strong>{plan}</strong></button>)}</div><Link href="/upgrade/owner">One-time upgrade payments</Link></div>}<small className="post-lifecycle-note">{accessRole === 'Commissioner / Komisiyoneri' ? 'Komisiyoneri listings expire 30 days after publication.' : `Property Owner listings expire according to the ${ownerTier} tier.`}</small></div>}
          <div className="post-form-actions">{step > 1 ? <button className="post-secondary-button" type="button" onClick={previous}><Icon name="arrow" size={14} /> Back</button> : <span />}{step < 3 ? <button className="post-primary-button" type="button" onClick={next}><span>Continue</span><Icon name="arrow" size={15} /></button> : publicationMode === 'Draft' ? <button className="post-primary-button" type="button" onClick={() => void saveListingNow(true)}>Save listing draft <Icon name="arrow" size={15} /></button> : <div className="post-payment-choice-actions"><button className="post-primary-button" type="button" onClick={saveListing}><Icon name="creditCard" size={15} /> Pay now <Icon name="arrow" size={15} /></button><button className="post-secondary-button" type="button" onClick={() => void saveListingNow(true)}>Pay later</button></div>}</div>
        </div><aside className="post-preview-wrap">
          <div className="post-preview-label"><span>Live preview</span><small>How it will look in Umutungo</small></div>
          <article className="post-preview-card">
            <div className="post-preview-image"><Image src={cover} alt="Property preview" fill sizes="(max-width: 900px) 100vw, 350px" /><span className="post-preview-badge">{intent}</span><button type="button" aria-label="Save preview"><Icon name="heart" size={17} /></button><div className="post-preview-dots">{gallery.slice(0, 4).map((_, index) => <i className={index === 0 ? 'is-active' : ''} key={index} />)}</div></div>
            <div className="post-preview-content"><span className="post-preview-type">{propertyType} Ã‚Â· Verified after review</span><h3>{listingTitle}</h3><p><Icon name="pin" size={13} /> {address || `${sector || district}, ${district}`}, {location}</p><strong>RWF {price || '0'} <small>{selectedIntent.transactionType === 'both' ? propertyType === 'Land' ? 'sale or lease' : 'sale or rent' : selectedIntent.transactionType === 'sell' ? 'asking' : propertyType === 'Hospitality' ? '/ night' : propertyType === 'Vehicle' || propertyType === 'Equipment' ? '/ day' : propertyType === 'Land' ? 'lease' : '/ month'}</small></strong>
              <div className="post-preview-stats">{isAsset ? <><span>{assetQuantity}<small>items</small></span><span>{assetCondition}<small>condition</small></span><span>{assetSpecifications || 'Details'}<small>specifications</small></span></> : isLand ? <><span>{area}<small>mÃ‚Â²</small></span><span>{landTenure}<small>tenure</small></span><span>{landRoadAccess}<small>road access</small></span></> : <><span>{bedrooms}<small>beds</small></span><span>{bathrooms}<small>baths</small></span><span>{area}<small>mÃ‚Â²</small></span></>}</div>
            </div>
          </article>
          <p className="post-preview-note"><Icon name="sparkles" size={14} /> Your draft stays private until you publish it.</p>
        </aside></div>
      </section>
    </div>
    {paymentPanelOpen && <div className="listing-payment-panel-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPaymentPanelOpen(false); }}><section className="listing-payment-panel" role="dialog" aria-modal="true" aria-labelledby="listing-payment-title"><button className="listing-payment-panel-close" type="button" aria-label="Close payment options" onClick={() => setPaymentPanelOpen(false)}><Icon name="x" size={18} /></button><span className="listing-payment-panel-eyebrow"><Icon name="lock" size={14} /> {feeQuote?.demo_mode ? 'Demo checkout' : 'Secure checkout'}</span><h2 id="listing-payment-title">Choose a payment method</h2><p className="listing-payment-panel-summary"><span><Icon name="creditCard" size={16} /> One-time upload fee</span><strong>{feeQuote ? 'RWF ' + feeQuote.fee.toLocaleString('en-RW') : 'Fee unavailable'}</strong></p>{feeQuote?.demo_mode && <p className="post-location-error" role="status">Demo mode: completing this step records a test payment only. No money will be charged.</p>}<div className="listing-payment-methods" role="radiogroup" aria-label="Payment method"><label className={paymentMethod === 'mobilemoneyrwanda' ? 'is-selected' : ''}><input type="radio" name="listing-payment-panel-method" value="mobilemoneyrwanda" checked={paymentMethod === 'mobilemoneyrwanda'} onChange={() => setPaymentMethod('mobilemoneyrwanda')} /><Icon name="phone" size={20} /><span><strong>Mobile money</strong><small>MTN Mobile Money or Airtel Money</small></span></label><label className={paymentMethod === 'card' ? 'is-selected' : ''}><input type="radio" name="listing-payment-panel-method" value="card" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} /><Icon name="creditCard" size={20} /><span><strong>Bank card</strong><small>Visa or Mastercard</small></span></label></div><label className="post-payment-email"><span><Icon name="mail" size={15} /> Email for your payment receipt</span><input type="email" value={paymentEmail} onChange={(event) => { setPaymentEmail(event.target.value); setSaveError(''); }} placeholder="you@example.com" autoComplete="email" required /></label>{paymentMethod === 'mobilemoneyrwanda' && <label className="post-payment-email"><span><Icon name="phone" size={15} /> Mobile money phone number</span><input type="tel" value={paymentPhone} onChange={(event) => { setPaymentPhone(event.target.value); setSaveError(''); }} placeholder="+250 78 123 4567" autoComplete="tel" inputMode="tel" /></label>}{saveError && <p className="post-location-error" role="alert">{saveError}</p>}<button className="post-primary-button listing-payment-continue" type="button" onClick={() => void saveListingNow()}><Icon name="lock" size={15} /> {feeQuote?.demo_mode ? 'Complete demo payment' : 'Continue to secure checkout'} <Icon name="arrow" size={15} /></button></section></div>}
</Container>;
}


