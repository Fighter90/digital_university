import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // DIG-13: dev-индикатор Next.js не должен попадать на скриншоты компонентов
  // (галерея /design сверяется с макетом по скриншотам).
  devIndicators: false,
};

export default nextConfig;
