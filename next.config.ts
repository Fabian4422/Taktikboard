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
          urlPattern: /\/_next\/static\/.*/i,
          handler: "CacheFirst" as const,
          options: {
            cacheName: "next-static",
            expiration: {
              maxEntries: 128,
              maxAgeSeconds: 60 * 60 * 24,
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
