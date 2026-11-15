import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
 poweredByHeader: false,
 async headers() {
  return [{source: '/:path*', headers: [{key: 'Permissions-Policy', value: 'microphone=(self), camera=(self)'}]}];
 }
};
export default nextConfig;
