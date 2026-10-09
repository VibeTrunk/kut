import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  async redirects() {
    return [
      // The game moved to flut.vibetrunk.com (ADR-137). The legacy host keeps
      // serving the same deployment, and this sends every path and query string
      // on to the new one. Next anchors the host pattern, so only this exact
      // host matches; previews and local hosts are unaffected. 307 until the
      // owner accepts the new domain, then 308 (slice 5). The release checker
      // probes this live (scripts/release/vercel-deployment-contract.mjs).
      {
        source: "/:path*",
        has: [{ type: "host", value: "kut\\.vibetrunk\\.com" }],
        destination: "https://flut.vibetrunk.com/:path*",
        permanent: false,
      },
      // Midweek Madness moved under Compete (ADR-107), so shared bracket and
      // match links keep working. `:path*` also matches `/club/midweek` itself,
      // and the query string (`?view=pick`) is carried over.
      { source: "/club/midweek/:path*", destination: "/midweek/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
