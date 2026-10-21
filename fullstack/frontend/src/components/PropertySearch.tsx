'use client';

import { FormEvent } from 'react';
import { Icon, IconName } from './Icons';
import { Language, t } from '../data/translations';
import { getDistrictNames, getSectorNames } from '../data/rwandaLocations';

type SearchOption = { value: string; label: string };
type SearchControlProps = {
  language: Language;
  label: string;
  value: string;
  options: SearchOption[];
  onChange: (value: string) => void;
  icon?: IconName;
  compact?: boolean;
  disabled?: boolean;
};

function SearchControl({ language, label, value, options, onChange, icon, compact = false, disabled = false }: SearchControlProps) {
  const selectedLabel = options.find((option) => option.value === value)?.label ?? options[0]?.label ?? '';
  return (
    <label className={`search-control${compact ? ' compact' : ''}${disabled ? ' is-disabled' : ''}`}>
      {icon && <Icon name={icon} size={18} />}
      <span className="search-control-copy">
        <small>{t(language, label)}</small>
        <strong>{selectedLabel}</strong>
      </span>
      <select className="search-control-native" aria-label={t(language, label)} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
      </select>
      <Icon name="chevron" size={15} />
    </label>
  );
}

type PropertySearchProps = { language: Language; categories: SearchOption[]; location: string; district: string; sector: string; type: string; intent: string; priceRange: string; onLocationChange: (value: string) => void; onDistrictChange: (value: string) => void; onSectorChange: (value: string) => void; onTypeChange: (value: string) => void; onIntentChange: (value: string) => void; onPriceRangeChange: (value: string) => void; onSubmit: () => void };

export function PropertySearch({ language, categories, location, district, sector, type, intent, priceRange, onLocationChange, onDistrictChange, onSectorChange, onTypeChange, onIntentChange, onPriceRangeChange, onSubmit }: PropertySearchProps) {
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); onSubmit(); };
  const provinceName = location === 'Kigali' ? 'City of Kigali' : location;
  const districtOptions = getDistrictNames(provinceName);
  const sectorOptions = district ? getSectorNames(provinceName, district) : [];
  const isHouse = type === 'houses';
  const hasSearchSelection = location !== 'Kigali' || district !== '' || sector !== '' || type !== 'Any type' || intent !== 'Buy or rent' || priceRange !== 'Any price';

  return (
    <form className={`property-search${isHouse ? '' : ' is-category-compact'}`} onSubmit={submit} aria-label={t(language, 'Search')}>
      <SearchControl language={language} label="Type" value={type} onChange={onTypeChange} icon="home" options={categories} />
      <SearchControl language={language} label="For sale / rent" value={intent} onChange={onIntentChange} compact options={[
        { value: 'Buy or rent', label: t(language, 'Buy or rent') },
        { value: 'Buy', label: t(language, 'Buy') },
        { value: 'Rent', label: t(language, 'Rent') },
      ]} />
      <SearchControl language={language} label="Price range" value={priceRange} onChange={onPriceRangeChange} compact options={[
        { value: 'Any price', label: t(language, 'Any price') },
        { value: 'Under RWF 500,000', label: t(language, 'Under RWF 500,000') },
        { value: 'RWF 500,000 - 1,000,000', label: t(language, 'RWF 500,000 - 1,000,000') },
        { value: 'Over RWF 1,000,000', label: t(language, 'Over RWF 1,000,000') },
      ]} />
      <SearchControl language={language} label="Location" value={location} onChange={onLocationChange} icon="pin" options={[
        { value: 'Kigali', label: t(language, 'Kigali') },
        { value: 'Eastern Province', label: t(language, 'Eastern Province') },
        { value: 'Northern Province', label: t(language, 'Northern Province') },
        { value: 'Southern Province', label: t(language, 'Southern Province') },
        { value: 'Western Province', label: t(language, 'Western Province') },
      ]} />
      {isHouse && <SearchControl key="district" language={language} label="District" value={district} onChange={onDistrictChange} icon="pin" compact options={[
        { value: '', label: t(language, 'Any district') },
        ...districtOptions.map((item) => ({ value: item, label: item })),
      ]} />}
      {isHouse && <SearchControl key="sector" language={language} label="Sector" value={sector} onChange={onSectorChange} icon="pin" compact disabled={!district} options={[
        { value: '', label: district ? (sectorOptions.length ? t(language, 'Any sector') : t(language, 'No sectors available')) : t(language, 'Select district') },
        ...sectorOptions.map((item) => ({ value: item, label: item })),
      ]} />}
      <button className="button button-primary search-submit" type="submit" disabled={!hasSearchSelection} aria-disabled={!hasSearchSelection}>{t(language, 'Search')} <Icon name="arrow" size={16} /></button>
    </form>
  );
}
