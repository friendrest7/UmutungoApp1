'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { AiChatbot } from '../../components/AiChatbot';
import { Icon } from '../../components/Icons';
import { InterfacePreferences } from '../../components/InterfacePreferences';
import { Logo } from '../../components/Logo';
import { apiBaseUrl, DirectoryProfile, publicUmutungoApi } from '../../lib/umutungoApi';
import { usePersistentLanguage } from '../../lib/language';

type DirectoryResponse = { items: DirectoryProfile[]; count: number };

function roleLabel(role: DirectoryProfile['role']) {
  return role === 'property_owner' ? 'Landlord' : 'Komisiyoneri';
}

export default function DirectoryPage() {
  const { language } = usePersistentLanguage();
  const [query, setQuery] = useState('');
  const [profiles, setProfiles] = useState<DirectoryProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDirectory = async (search: string) => {
    setLoading(true);
    setError('');
    try {
      const params = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
      const response = await publicUmutungoApi<DirectoryResponse>(`/api/v1/directory${params}`);
      setProfiles(response?.items ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Directory unavailable right now.');
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get('search') ?? '';
    setQuery(initial);
    void loadDirectory(initial);
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = query.trim();
    window.history.replaceState(null, '', `/directory${next ? `?search=${encodeURIComponent(next)}` : ''}`);
    void loadDirectory(next);
  };

  return (
    <><main className="directory-page">
      <header className="directory-page-header">
        <Link href="/" aria-label="Umutungo home"><Logo /></Link>
        <div className="standalone-header-actions">
          <InterfacePreferences />
          <Link className="directory-back-link" href="/"><Icon name="arrow" size={14} /> Back to marketplace</Link>
        </div>
      </header>
      <section className="directory-hero">
        <div className="container">
          <p className="eyebrow">Umutungo directory</p>
          <h1>Find the people<br /><em>behind the property.</em></h1>
          <p>Search active landlords and Komisiyoneri by name, business, or area. We show public professional details only.</p>
          <form className="directory-search-form" onSubmit={submit}>
            <Icon name="search" size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, business, or area" aria-label="Search landlords and Komisiyoneri" />
            <button className="button button-primary" type="submit">Search <Icon name="arrow" size={15} /></button>
          </form>
        </div>
      </section>
      <section className="directory-results container">
        <div className="directory-results-heading">
          <div><h2>{query ? `Results for “${query}”` : 'Landlords and Komisiyoneri'}</h2></div>
          <span>{loading ? 'Searching…' : `${profiles.length} found`}</span>
        </div>
        {error && <p className="directory-error" role="alert">{error}{!apiBaseUrl() ? ' Set NEXT_PUBLIC_API_URL for local development.' : ''}</p>}
        {!loading && !error && !profiles.length && <div className="directory-empty"><Icon name="search" size={22} /><h3>{query ? 'No property found' : 'No professionals found'}</h3><p>{query ? 'Try another meaningful search, like “white car”.' : 'Try a different name, business, or location.'}</p></div>}
        <div className="professional-directory-grid">
          {profiles.map((profile) => <article className="professional-card" key={profile.id}>
            <div className="professional-card-top"><span className="professional-avatar">{profile.name.slice(0, 2).toUpperCase()}</span><span className="professional-role">{roleLabel(profile.role)}</span></div>
            <h3>{profile.name}</h3>
            {profile.business_name && <p className="professional-business">{profile.business_name}</p>}
            {profile.physical_address && <p className="professional-location"><Icon name="pin" size={14} /> {profile.physical_address}</p>}
            <div className="professional-card-footer"><span>{profile.published_listings} published {profile.published_listings === 1 ? 'listing' : 'listings'}</span>{profile.verified && <span className="professional-verified"><Icon name="check" size={13} /> Verified</span>}</div>
          </article>)}
        </div>
      </section>
    </main><AiChatbot language={language} /></>
  );
}
