import type { NextConfig } from "next";

/**
 * Browser → `/api/investments/...`
 * Next → `http://localhost:4000/api/investments/...`
 * (Nest uses a global `/api` prefix — do not strip it.)
 */
const backendOrigin =
  process.env.API_PROXY_TARGET?.replace(/\/$/, "") || "http://localhost:4000";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: `${backendOrigin}/api/:path*`,
        },
      ],
      // output: ['export'],
    };
  },
};

export default nextConfig;
