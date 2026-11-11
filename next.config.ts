import type { NextConfig } from 'next';

// DIG-7: standalone-сборка — самодостаточный сервер для Docker-образа
// (deploy/Dockerfile, docker compose: app + db + caddy).
const nextConfig: NextConfig = { output: 'standalone' };

export default nextConfig;
