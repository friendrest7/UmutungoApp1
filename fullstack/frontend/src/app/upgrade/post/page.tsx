import Link from 'next/link';
import { Icon } from '../../../components/Icons';

export default function TenantPostUpgradePage() {
  return <main className="tenant-post-upgrade-page">
    <header><Link href="/tenant">← Back to tenant account</Link><strong>Umutungo</strong></header>
    <section className="tenant-post-upgrade-card">
      <span className="role-dashboard-eyebrow">TENANT ACCOUNT</span>
      <h1>Upgrade to Post</h1>
      <p className="tenant-post-upgrade-lead">To publish a property, continue with a posting account. Choose whether you are listing as a property owner, landlord, or Komisiyoneri.</p>
      <div className="tenant-post-upgrade-steps">
        <article><span>01</span><div><strong>Choose your posting role</strong><small>Select the account type that matches your relationship to the property.</small></div></article>
        <article><span>02</span><div><strong>Add listing details</strong><small>Enter the location, price, features, and photos you want people to see.</small></div></article>
        <article><span>03</span><div><strong>Publish when ready</strong><small>Review your listing before making it visible in the marketplace.</small></div></article>
      </div>
      <p className="tenant-post-upgrade-note">No payment is requested on this page. Any posting or account fees will be shown before you confirm them.</p>
      <Link className="role-dashboard-primary" href="/post-property">Continue to posting setup <Icon name="arrow" size={16} /></Link>
    </section>
  </main>;
}
