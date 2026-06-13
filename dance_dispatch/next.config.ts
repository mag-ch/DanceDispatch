import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";


// Using remotePatterns with an array map for cleaner config
const hostnames = [
  'static.wixstatic.com',
  'imgproxy.ra.co',
  'yet-another-domain.com',
  'cdn.prod.website-files.com',
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
  'scontent-lga3-3.cdninstagram.com',
  '155089617.cdn6.editmysite.com',
  's3-media0.fl.yelpcdn.com',
  'magneticmag.com',
  'starchildrooftop.com',
  'www.compass.com',
  'cdn.sanity.io',
  'res.cloudinary.com',
  'pyxis.nymag.com',
  'www.therotunda.org',
  'scontent-phl2-1.xx.fbcdn.net',
  'hypersoul.co',
  'uploads.tickettailorassets.com',
  'images.squarespace-cdn.com',
  'static.ra.co',
  'assets.beatportal.com',
  'f4.bcbits.com',
  'image-cdn-fa',
  'i.ytimg.com',
  'i1.sndcdn.com',
  'wintermusicconference.com',
  'images.squarespace-cdn.com',
  'funkformat.com',
  's3.eu-west-2.amazonaws.com',
  'www.hnt.fm',
  'gkiwxeqrcmqotegowgil.supabase.co',
  'i.imgur.com',
  'imgur.com',
  'partiful.imgix.net',
  'primary.jwwb.nl',
  'knockdown-center.directus.app'
  
];

const uniqueHostnames = [...new Set(hostnames)];
const nextConfig: NextConfig = {
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
 images: {
   remotePatterns: uniqueHostnames.map((hostname) => ({
      protocol: 'https',
      hostname,
      port: '',
      pathname: '/**',
    })),
  },
};

export default nextConfig;
module.exports = nextConfig;
