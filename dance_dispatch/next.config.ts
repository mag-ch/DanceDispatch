import type { NextConfig } from "next";


// Using remotePatterns with an array map for cleaner config
const hostnames = [
  'static.wixstatic.com',
  'imgproxy.ra.co',
  'yet-another-domain.com',
  'imgix.bustle.com',
  'phosphor.utils.elfsightcdn.com',
  'www.eventbrite.com',
  'dice-media.imgix.net',
  'scontent-lga3-2.cdninstagram.com',
  'cityparksfoundation.org',
  'scontent-lga3-1.cdninstagram.com'
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
