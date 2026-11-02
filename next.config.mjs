// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
/** @type {import('next').NextConfig} */

// STATIC_EXPORT=1 → GitHub Pages build: static export served under the
// project subpath, with the server-only /api/export route removed by the
// workflow. Unset (default) → normal dev/build with native-ffmpeg export.
const isStatic = process.env.STATIC_EXPORT === '1';
const basePath = isStatic ? '/motion-studio-open' : '';

const nextConfig = {
  agentRules: false,      // keep Next.js from generating AI-agent instruction files
  reactStrictMode: false, // avoid double Pixi mount in dev
  devIndicators: false,   // hide the dev overlay badge (it covers the play button)
  outputFileTracingIncludes:{'/api/updates':['./scripts/update-common.cjs','./scripts/update-worker.cjs','./scripts/local-app.cjs']},
  outputFileTracingExcludes:{'/*':['./verification/**/*','./dist-desktop/**/*','./desktop/**/*','./.env*','./.shots/**/*','./public/exports/**/*','./public/demo-arqe/**/*']},
  async headers() {
    return [{
      source: '/',
      headers: [{
        key: 'Cache-Control',
        // Safari web apps otherwise retain a year-old HTML shell across local
        // rebuilds and keep requesting JavaScript chunks that no longer exist.
        value: 'no-store, max-age=0, must-revalidate',
      }],
    }];
  },
  ...(isStatic && {
    output: 'export',
    basePath,
    images: { unoptimized: true }, // no next/image today; keeps future use export-safe
  }),
  ...(!isStatic && {
    output: 'standalone',
  }),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_STATIC_EXPORT: isStatic ? '1' : '',
  },
};

export default nextConfig;
