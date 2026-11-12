'use client';

import Image from 'next/image';
import Link from 'next/link';
import { AuthModal, type AuthRole } from './AuthModal';
import { Icon } from './Icons';
import { Logo } from './Logo';
import styles from './OwnerSignIn.module.css';

type Copy = { eyebrow: string; headline: string; points: string[]; image: string; imageAlt: string; formEyebrow: string; title: string; lead: string };

const general: Copy = {
  eyebrow: 'Umutungo marketplace',
  headline: 'Homes, land and more across Rwanda.',
  points: ['Save properties and compare them later', 'Message owners and book viewings', 'Your activity stays private to your account'],
  image: '/properties/kigali-downtown.jpg',
  imageAlt: 'Kigali city centre',
  formEyebrow: 'Welcome back',
  title: 'Sign in to Umutungo',
  lead: 'Keep your properties, messages, applications and activity in one secure place.',
};

const copy: Partial<Record<AuthRole, Copy>> = {
  Landlord: {
    eyebrow: 'Umutungo for landlords',
    headline: 'Every rental, payment and repair in one place.',
    points: ['See who has paid rent and who is overdue', 'Log repair requests and follow them to done', 'Your tenant records stay private to your account'],
    image: '/properties/rwanda-house-01.jpg',
    imageAlt: 'A modern two-storey family home in Kigali',
    formEyebrow: 'Landlord workspace',
    title: 'Sign in to manage your properties',
    lead: 'Your portfolio, rent and repair records open once we confirm your account.',
  },
  'Property Owner': {
    eyebrow: 'Umutungo for property owners',
    headline: 'Publish, promote and manage your properties.',
    points: ['List properties on the Umutungo marketplace', 'Answer enquiries and track promotion upgrades', 'Your records stay private to your account'],
    image: '/properties/kigali-neighborhood.jpg',
    imageAlt: 'A quiet residential street in Kigali',
    formEyebrow: 'Owner workspace',
    title: 'Sign in to manage your properties',
    lead: 'Your listings, enquiries and upgrades open once we confirm your account.',
  },
  'Commissioner / Komisiyoneri': {
    eyebrow: 'Umutungo for Komisiyoneri',
    headline: 'Your listings, clients and visits together.',
    points: ['Publish listings with upload slots', 'Reply to enquiries and schedule visits', 'Keep every client conversation in one place'],
    image: '/properties/commercial-02.jpg',
    imageAlt: 'A commercial building in Kigali',
    formEyebrow: 'Komisiyoneri workspace',
    title: 'Sign in to your workspace',
    lead: 'Manage listings, enquiries, messages and visits.',
  },
  Client: {
    ...general,
    formEyebrow: 'Your account',
    title: 'Sign in to continue',
  },
  Tenant: {
    eyebrow: 'Umutungo for tenants',
    headline: 'Find a place and manage your rental.',
    points: ['Apply for rentals and book viewings', 'Track rent, repairs and messages', 'Your details stay private to your account'],
    image: '/properties/apartment-01.jpg',
    imageAlt: 'A bright apartment living room',
    formEyebrow: 'Your account',
    title: 'Sign in to continue',
    lead: 'Keep saved places, applications, viewings and conversations together.',
  },
  Admin: {
    ...general,
    eyebrow: 'Umutungo administration',
    headline: 'Run the marketplace with confidence.',
    points: ['Review listings and accounts', 'Manage plans, payments and settings', 'Every action is recorded in the audit log'],
    formEyebrow: 'Administrator access',
    title: 'Sign in as an administrator',
    lead: 'Only administrator accounts can open this area.',
  },
};

/**
 * Full-page sign-in used everywhere the app needs an account.
 * Left: a photo with what the account offers. Right: every sign-in method,
 * shown inline. The methods come from AuthModal's "page" variant, so Google,
 * phone code, sign-up and the development test accounts behave exactly as
 * they did in the old pop-up.
 */
export function SignInPage({ audience, denied = false, notice, onSignedIn }: { audience?: AuthRole; denied?: boolean; notice?: string; onSignedIn: (role: AuthRole) => void }) {
  const content = (audience && copy[audience]) || general;
  const label = audience === 'Commissioner / Komisiyoneri' ? 'Komisiyoneri' : audience?.toLowerCase();
  return <main className={styles.page}>
    <section className={styles.visual}>
      <Image className={styles.photo} src={content.image} alt={content.imageAlt} fill priority sizes="(max-width: 860px) 100vw, 50vw" />
      <div className={styles.shade} aria-hidden="true" />
      <Link className={styles.brand} href="/" aria-label="Umutungo home"><Logo darkMode /></Link>
      <div className={styles.pitch}>
        <p className={styles.pitchEyebrow}>{content.eyebrow}</p>
        <h2>{content.headline}</h2>
        <ul>{content.points.map((point) => <li key={point}><span><Icon name="check" size={13} /></span>{point}</li>)}</ul>
      </div>
    </section>

    <section className={styles.panel}>
      <Link className={styles.back} href="/"><span aria-hidden="true">←</span> Back to marketplace</Link>
      <div className={styles.form}>
        <p className={styles.eyebrow}>{content.formEyebrow}</p>
        <h1>{content.title}</h1>
        <p className={styles.lead}>{content.lead}</p>
        {denied && label && <p className={styles.denied} role="alert"><Icon name="lock" size={15} /><span>You're signed in with an account that isn't a {label} account. Sign in with your {label} account to continue.</span></p>}
        {notice && !denied && <p className={styles.denied} role="status"><Icon name="lock" size={15} /><span>{notice}</span></p>}
        <AuthModal variant="page" role={audience} onSuccess={onSignedIn} />
      </div>
      <p className={styles.help}>Need help? <Link href="/contact">Contact the Umutungo team</Link></p>
    </section>
  </main>;
}

/** The landlord / property owner workspace sign-in (kept for existing callers). */
export function OwnerSignIn({ audience, denied = false, onSignedIn }: { audience: 'Landlord' | 'Property Owner'; denied?: boolean; onSignedIn: () => void }) {
  return <SignInPage audience={audience} denied={denied} onSignedIn={() => onSignedIn()} />;
}
