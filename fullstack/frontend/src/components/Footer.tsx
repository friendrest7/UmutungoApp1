import { useEffect, useState, type FormEvent } from 'react';
import { Language, t } from '../data/translations';
import { apiToken, publicUmutungoApi, umutungoApi } from '../lib/umutungoApi';
import { goToSignIn } from '../lib/signIn';
import { Icon } from './Icons';
import { Logo } from './Logo';

export function Footer({ language, darkMode = false }: { language: Language; darkMode?: boolean }) {
  const [signedIn, setSignedIn] = useState(false);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState('');
  const [submissionError, setSubmissionError] = useState('');
  const [submittedStories, setSubmittedStories] = useState<Array<{ id: string; name: string; body: string }>>([]);
  useEffect(() => {
    setSignedIn(Boolean(apiToken()));
    void publicUmutungoApi<{ items: Array<{ id: string; name: string; body: string }> }>('/api/v1/testimonials', { cache: 'no-store' })
      .then((result) => setSubmittedStories(result?.items ?? []))
      .catch(() => setSubmittedStories([]));
    const updateAuth = () => setSignedIn(Boolean(apiToken()));
    window.addEventListener('umutungo:auth-changed', updateAuth);
    return () => window.removeEventListener('umutungo:auth-changed', updateAuth);
  }, []);
  const submitStory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmissionError(''); setSubmissionMessage(''); setSubmitting(true);
    try {
      await umutungoApi('/api/v1/testimonials', { method: 'POST', body: JSON.stringify({ body }) });
      setBody(''); setSubmissionMessage('Thanks for sharing. Your story is submitted for review before it appears publicly.');
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Your story could not be submitted. Please try again.');
    } finally { setSubmitting(false); }
  };
  const testimonials = [
    { name: 'Aline Mukamana', location: 'Kigali', quote: t(language, 'testimonial-aline') },
    { name: 'Eric Niyonzima', location: 'Huye', quote: t(language, 'testimonial-eric') },
    { name: 'Claudine Uwase', location: 'Musanze', quote: t(language, 'testimonial-claudine') },
  ];
  return (
    <footer className="site-footer" id="footer-contact">
      <section className="community-testimonials container" aria-labelledby="community-testimonials-title">
        <div className="community-testimonials-heading"><h2 id="community-testimonials-title">{t(language, 'Witnesses')}</h2></div>
        <div className="community-testimonials-grid">
          {testimonials.map((item) => <figure className="community-testimonial" key={item.name}><blockquote>{item.quote}</blockquote><figcaption><strong>{item.name}</strong><span>{item.location}, Rwanda</span></figcaption></figure>)}
          {submittedStories.map((item) => <figure className="community-testimonial" key={item.id}><blockquote>{item.body}</blockquote><figcaption><strong>{item.name}</strong><span>Umutungo community</span></figcaption></figure>)}
        </div>
        <div className="community-testimonial-submit">
          <div><h3>Have a story to share?</h3><p>Tell us how Umutungo helped you. Stories are reviewed before they appear here.</p></div>
          {signedIn ? <form onSubmit={submitStory}>
            <label htmlFor="testimonial-story">Your witness</label>
            <textarea id="testimonial-story" value={body} onChange={(event) => setBody(event.target.value)} minLength={20} maxLength={1000} rows={4} placeholder="Share your experience (20–1000 characters)" required disabled={submitting} />
            <div className="testimonial-form-footer"><span>{body.length}/1000</span><button type="submit" disabled={submitting || body.trim().length < 20}>{submitting ? 'Submitting…' : 'Submit your story'}</button></div>
            {submissionMessage && <p className="testimonial-form-status" role="status">{submissionMessage}</p>}
            {submissionError && <p className="testimonial-form-error" role="alert">{submissionError}</p>}
          </form> : <button className="testimonial-sign-in" type="button" onClick={() => goToSignIn('Client')}>Sign in to share your story</button>}
        </div>
      </section>
      <div className="container app-download" id="app-download">
        <div className="app-download-copy"><h2>{t(language, 'Get the Umutungo app')}</h2><p>{t(language, 'Keep your property search close.')}</p></div>
        <div className="app-download-options" aria-label={t(language, 'Mobile app downloads')}>
          <a className="app-download-option" href="https://drive.google.com/file/d/1N5Jtha48W3UAY3DEq86RYQzKhEG5pc26/view?usp=sharing" target="_blank" rel="noopener noreferrer"><span className="app-download-icon"><Icon name="download" size={19} /></span><span><small>{t(language, 'Download on')}</small><strong>{t(language, 'Android app')}</strong></span></a>
          <a className="app-download-option" href="https://apps.apple.com/rw/search?term=Umutungo" target="_blank" rel="noopener noreferrer" aria-label="Search Umutungo on the App Store"><span className="app-download-icon"><Icon name="apple" size={19} /></span><span><small>{t(language, 'Download on')}</small><strong>{t(language, 'iOS app')}</strong></span></a>
        </div>
      </div>
      <div className="container footer-main">
        <div className="footer-brand-block"><a href="/" aria-label="Umutungo home"><Logo darkMode /></a><p>{t(language, 'Rwanda’s marketplace for homes, land and everyday assets.')}</p><a className="footer-register-link" href="/register">{t(language, 'Create an account')} <Icon name="arrow" size={14} /></a></div>
        <nav className="footer-column" aria-label={t(language, 'Explore')}><span>{t(language, 'Explore')}</span><a href="/categories/properties">{t(language, 'All listings')}</a><a href="/#categories">{t(language, 'Property categories')}</a><a href="/categories/vehicles">{t(language, 'Vehicles and other assets')}</a><a href="/post-property">{t(language, 'Post a property')}</a></nav>
        <nav className="footer-column" aria-label={t(language, 'For business')}><span>{t(language, 'For business')}</span><a href="/register?role=Komisiyoneri">{t(language, 'For Komisiyoneri')}</a><a href="/register?role=Property%20Owner">{t(language, 'For Property Owners')}</a><a href="/landlord">{t(language, 'For Landlords')}</a><a href="/upgrade">{t(language, 'Plans and pricing')}</a></nav>
        <nav className="footer-column" aria-label={t(language, 'Company')}><span>{t(language, 'Company')}</span><a href="/about">{t(language, 'About us')}</a><a href="/about">{t(language, 'Our promise')}</a><a href="/how-it-works">{t(language, 'How it works')}</a></nav>
        <div className="footer-column"><span>{t(language, 'Support')}</span><a href="/contact">{t(language, 'Contact us')}</a><a href="mailto:hello@umutungo.rw">hello@umutungo.rw</a><a className="footer-social-link instagram-link" href="#home" aria-label="Instagram"><Icon name="instagram" size={22} />Instagram <span aria-hidden="true">↗</span></a><a className="footer-social-link linkedin-link" href="#home" aria-label="LinkedIn"><Icon name="linkedin" size={22} />LinkedIn <span aria-hidden="true">↗</span></a></div>
      </div>
      <div className="container footer-bottom"><span>{t(language, '© 2024 Umutungo. Made in Rwanda.')}</span><span><a href="mailto:hello@umutungo.rw?subject=Privacy%20policy%20request">{t(language, 'Privacy')}</a><a href="mailto:hello@umutungo.rw?subject=Terms%20of%20use%20request">{t(language, 'Terms')}</a></span></div>
    </footer>
  );
}
