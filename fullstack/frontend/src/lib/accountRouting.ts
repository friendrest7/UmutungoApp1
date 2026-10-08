export function dashboardPathForAccountRole(role?: string) {
  switch ((role ?? '').trim().toLowerCase()) {
    case 'admin': return '/admin';
    case 'commissioner / komisiyoneri':
    case 'commissioner':
    case 'komisiyoneri': return '/commissioner';
    case 'landlord': return '/landlord';
    case 'property owner':
    case 'property_owner': return '/property-owner';
    default: return '/tenant';
  }
}
