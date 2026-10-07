/** @type {import('next').NextConfig} */
const defaultBackend = 'https://umutungoappbackend1.onrender.com';
const configuredBackend = (process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/$/, '');
const localBackend = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configuredBackend);
const backend = configuredBackend && !(process.env.NODE_ENV === 'production' && localBackend) ? configuredBackend : defaultBackend;

const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${backend}/api/v1/:path*` }];
  },
};

export default nextConfig;
