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
  'scontent-lga3-1.cdninstagram.com',
  'www.newyorkbyrail.com',
  'encrypted-tbn0.gstatic.com',
  'upload.wikimedia.org',
  'lh3.googleusercontent.com',
  'images.sideways.nyc',
  'gibneydance.org',
  'www.bkmag.com',
  'cdn.mos.cms.futurecdn.net',
  'cdn.bushwickdaily.com',
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
