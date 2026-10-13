/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://agentic-research-assistant-syg1.onrender.com/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
