import { FormEvent, useEffect, useState } from 'react';
import { Language, t } from '../data/translations';

type Review = { id: number; name: string; rating: number; message: string };

const starterReviews: Review[] = [
  { id: 1, name: 'Aline M.', rating: 5, message: 'The search felt calmer because I could compare the important details in one place.' },
  { id: 2, name: 'Patrick N.', rating: 4, message: 'The location information helped our family narrow down the right neighbourhood.' },
];

export function ReviewPanel({ language }: { language: Language }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(5);
  const [reviews, setReviews] = useState(starterReviews);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem('umutungo-reviews') ?? '[]') as Review[];
      if (Array.isArray(stored)) setReviews([...stored, ...starterReviews.filter((review) => !stored.some((item) => item.id === review.id))]);
    } catch { /* Keep the starter reviews available if storage is unavailable. */ }
  }, []);

  const submitReview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;
    const review = { id: Date.now(), name: name.trim(), rating, message: message.trim() };
    setReviews((current) => {
      const next = [review, ...current];
      window.localStorage.setItem('umutungo-reviews', JSON.stringify(next));
      return next;
    });
    setName('');
    setEmail('');
    setMessage('');
    setRating(5);
    setSubmitted(true);
  };

  return (
    <section className="review-section section container" id="reviews">
      <div className="review-panel">
        <div className="review-intro">
          <p className="eyebrow">{t(language, 'Your voice matters')}</p>
          <h2>{t(language, 'Help us make the search better.')}</h2>
          <p>{t(language, 'Tell us what is working, what is missing, and how Umutungo can make finding a place easier for you.')}</p>
          <div className="review-rating-summary"><strong>{reviews.length ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1) : '0.0'}</strong><span>★★★★★<small>{t(language, 'from early reviewers')}</small></span></div>
        </div>
        <form className="review-form" onSubmit={submitReview}>
          <label><span>{t(language, 'Your name')}</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder={t(language, 'Enter your name')} required /></label>
          <label><span>{t(language, 'Email address')}</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t(language, 'Enter your email')} required /></label>
          <fieldset><legend>{t(language, 'Your rating')}</legend><div className="rating-input">{[1, 2, 3, 4, 5].map((value) => <button key={value} className={value <= rating ? 'is-selected' : ''} type="button" aria-label={`${value} ${t(language, 'stars')}`} onClick={() => setRating(value)}>★</button>)}</div></fieldset>
          <label><span>{t(language, 'Your review')}</span><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder={t(language, 'Share your experience')} rows={4} required /></label>
          <button className="button button-primary review-submit" type="submit">{t(language, 'Submit review')} <span>↗</span></button>
          {submitted && <p className="review-success" role="status">{t(language, 'Thank you for sharing your experience.')}</p>}
        </form>
      </div>
      <div className="review-list"><div className="review-list-heading"><h3>{t(language, 'Recent reviews')}</h3><span>{reviews.length} {t(language, 'reviews')}</span></div>{reviews.map((review) => <article className="review-item" key={review.id}><div className="review-item-top"><strong>{review.name}</strong><span>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></div><p>{t(language, review.message)}</p></article>)}</div>
    </section>
  );
}
