import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ["canvas"],
  turbopack: {
    resolveAlias: {
      canvas: "./lib/empty-module.ts",
      konva: "konva/lib/index.js",
    },
  },
  webpack: (config, { isServer }) => {
    // Browser-Build von Konva nutzen (main zeigt auf index-node.js mit canvas-Abhängigkeit)
    if (!isServer) {
      config.resolve.mainFields = ["browser", "module", "main"];
      // Weniger async Chunks: Module möglichst mit dem initialen Client-Bundle laden
      // (verhindert Failed to fetch auf veraltete Chunk-URLs in der PWA)
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: "all",
          maxAsyncRequests: 1,
          cacheGroups: {
            default: false,
            vendors: false,
            framework: {
              name: "framework",
              test: new RegExp(String.raw`[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]`),
              chunks: "all",
              priority: 40,
              enforce: true,
            },
            lib: {
              name: "lib",
              test: new RegExp(String.raw`[\\/]node_modules[\\/]`),
              chunks: "all",
              priority: 30,
              minChunks: 1,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }

    config.resolve.alias = {
      ...config.resolve.alias,
      // Node-canvas nur im Browser-Bundle ignorieren
      canvas: false,
    };

    return config;
  },
};

/** PWA nur im Production-Build aktivieren (kein Service-Worker-Caching in Development). */
function withOptionalPWA(config: NextConfig): NextConfig {
  if (process.env.NODE_ENV === "development") {
    return config;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const withPWAInit = require("@ducanh2912/next-pwa").default as typeof import("@ducanh2912/next-pwa").default;

  const withPWA = withPWAInit({
    dest: "public",
    disable: false,
    register: true,
    reloadOnOnline: true,
    workboxOptions: {
      disableDevLogs: true,
      // Ersetzt Defaults: Supabase nie cachen; Next-Assets mit kurzer CacheFirst-Strategie
      runtimeCaching: [
        {
          urlPattern: ({ url }: { url: URL }) =>
            url.hostname.endsWith("supabase.co") || url.hostname.includes("supabase"),
          handler: "NetworkOnly" as const,
        },
        {
          // JS-Chunks nie aus dem SW-Cache — sonst Failed to fetch nach Deployments
          urlPattern: /\/_next\/static\/chunks\/.*/i,
          handler: "NetworkOnly" as const,
        },
        {
          urlPattern: /\/_next\/static\/.*/i,
          handler: "NetworkFirst" as const,
          options: {
            cacheName: "next-static",
            networkTimeoutSeconds: 5,
            expiration: {
              maxEntries: 64,
              maxAgeSeconds: 60 * 60,
            },
          },
        },
        {
          urlPattern: /\/_next\/data\/.*/i,
          handler: "NetworkFirst" as const,
          options: {
            cacheName: "next-data",
            networkTimeoutSeconds: 10,
            expiration: {
              maxEntries: 64,
              maxAgeSeconds: 60 * 60 * 24,
            },
          },
        },
        {
          urlPattern: ({ request }: { request: Request }) => request.destination === "document",
          handler: "NetworkFirst" as const,
          options: {
            cacheName: "documents",
            networkTimeoutSeconds: 10,
            expiration: {
              maxEntries: 32,
              maxAgeSeconds: 60 * 60 * 24,
            },
          },
        },
      ],
    },
  });

  return withPWA(config);
}

export default withOptionalPWA(nextConfig);
