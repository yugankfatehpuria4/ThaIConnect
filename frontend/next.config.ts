import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

// Pin Turbopack root to this app — prevents picking up ~/package-lock.json
// and spawning hundreds of Node workers (MallocStackLogging flood).
const appRoot = path.dirname(fileURLToPath(import.meta.url));
// Use 127.0.0.1 (not "localhost") for the dev proxy target: on macOS, Node
// resolves "localhost" to IPv6 ::1 first, and if the backend only listens on
// IPv4 the proxy floods with ECONNREFUSED ::1 before falling back.
const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://127.0.0.1:5002')
  .replace(/\/$/, '');

const nextConfig: NextConfig = {
  turbopack: {
    root: appRoot,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiBaseUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
