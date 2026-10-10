import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  async redirects() {
    return [
      // The game moved to flut.vibetrunk.com (ADR-137). The legacy host keeps
      // serving the same deployment, and this sends every path and query string
      // on to the new one. Next anchors the host pattern, so only this exact
      // host matches; previews and local hosts are unaffected. It stays a 307:
      // the switch to 308 (slice 5) was declined. docs/RELEASING.md checks it
      // after each deployment.
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
