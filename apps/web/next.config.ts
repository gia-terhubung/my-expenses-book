import type { NextConfig } from "next";

/**
 * Fully static site: `next build` writes plain HTML/CSS/JS to `out/`.
 * No server features (headers, redirects, image optimisation) are available;
 * response headers live in `vercel.json`.
 */
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
