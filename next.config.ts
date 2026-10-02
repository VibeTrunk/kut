import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  async redirects() {
    return [
      // Midweek Madness moved under Compete (ADR-107), so shared bracket and
      // match links keep working. `:path*` also matches `/club/midweek` itself,
      // and the query string (`?view=pick`) is carried over.
      { source: "/club/midweek/:path*", destination: "/midweek/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
