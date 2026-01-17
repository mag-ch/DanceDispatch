import type { NextConfig } from "next";


// Using remotePatterns with an array map for cleaner config
const hostnames = [
  'static.wixstatic.com',
  'imgproxy.ra.co',
  'yet-another-domain.com',
  'imgix.bustle.com',
];

const nextConfig: NextConfig = {
 images: {
    remotePatterns: hostnames.map((hostname) => ({
      protocol: 'https',
      hostname,
      port: '',
      pathname: '/**',
    })),
  },
};

export default nextConfig;
module.exports = nextConfig;
