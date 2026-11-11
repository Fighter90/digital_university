import type { NextConfig } from 'next';
import path from 'node:path';

/**
 * DIG-12 (round 3): dev and production builds must never share a distDir.
 * `next dev --turbopack` rewrites manifests (e.g. deletes
 * `.next/server/pages-manifest.json`) while a concurrent `next build`
 * collects page data — that is the ENOENT that killed the build gate.
 * Everything non-development (build, start, CI shells) stays on `.next`.
 */
export const resolveDistDir = (nodeEnv: string | undefined): string =>
  nodeEnv === 'development' ? '.next-dev' : '.next';

const nextConfig: NextConfig = {
  distDir: resolveDistDir(process.env.NODE_ENV),
  // DIG-12: pin the Turbopack workspace root to the repo. Without it Next
  // infers the root from lockfile locations — a stray package-lock.json in a
  // parent dir (e.g. $HOME) makes two builds disagree about the root, and
  // incremental `.next` state from one breaks the other with random ENOENT
  // errors (gates: build=fail).
  turbopack: {
    root: path.dirname(import.meta.url.replace(/^file:\/\//, '')),
  },
};

export default nextConfig;
