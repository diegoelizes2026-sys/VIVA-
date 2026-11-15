import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
 poweredByHeader: false,
 async headers() {
  return [
   {source: '/:path*', headers: [{key: 'Permissions-Policy', value: 'microphone=(self), camera=(self)'}]},
   {source: '/sw.js', headers: [{key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate'}]},
   {source: '/manifest.webmanifest', headers: [{key: 'Cache-Control', value: 'no-cache, must-revalidate'}]}
  ];
 }
};
export default nextConfig;
