/** @type {import('next').NextConfig} */
const defaultBackend = 'https://umutungoapp1-backend.onrender.com';
const configuredBackend = (process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/$/, '');
const localBackend = /^https?:\/\/(localhost|127\.0\.1)(:\d+)?$/i.test(configuredBackend);
const backend = configuredBackend && !(process.env.NODE_ENV === 'production' && localBackend) ? configuredBackend : defaultBackend;
const backendUrl = new URL(backend);

const nextConfig = {
  images: {
    formats: ['image/webp'],
    remotePatterns: [{
      protocol: backendUrl.protocol.slice(0, -1),
      hostname: backendUrl.hostname,
      ...(backendUrl.port ? { port: backendUrl.port } : {}),
      pathname: '/uploads/**',
    }],
  },
  async rewrites() {
    return [
      { source: '/api/readyz', destination: `${backend}/readyz` },
      { source: '/api/v1/:path*', destination: `${backend}/api/v1/:path*` },
    ];
  },
};

export default nextConfig;
