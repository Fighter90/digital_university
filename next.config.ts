import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
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
