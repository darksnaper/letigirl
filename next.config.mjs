for (const key of Object.keys(process.env)) {
  if (key.endsWith('POSTGRES_PRISMA_URL') || key.endsWith('DATABASE_URL')) {
    process.env.POSTGRES_PRISMA_URL = process.env.POSTGRES_PRISMA_URL || process.env[key];
    process.env.DATABASE_URL = process.env.DATABASE_URL || process.env[key];
  }
  if (key.endsWith('POSTGRES_URL_NON_POOLING') || key.endsWith('DATABASE_URL_UNPOOLED')) {
    process.env.POSTGRES_URL_NON_POOLING = process.env.POSTGRES_URL_NON_POOLING || process.env[key];
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
