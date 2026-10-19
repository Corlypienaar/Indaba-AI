/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Make sure the content file ships with the deployed serverless functions,
    // so the API route can read it at runtime on Vercel.
    outputFileTracingIncludes: {
      "/api/chat": ["./content/**"],
      "/": ["./content/**"]
    }
  }
};

export default nextConfig;
