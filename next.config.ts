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
    if (!isServer) {
      config.resolve.mainFields = ["browser", "module", "main"];

      /**
       * Code-Splitting für Client radikal abschalten.
       * Verhindert separate `/chunks/493-*.js` Dateien, die nach Deployments
       * in PWAs mit stale Cache als Failed to fetch abstürzen.
       */
      config.optimization = {
        ...config.optimization,
        runtimeChunk: false,
        splitChunks: false,
      };
    }

    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };

    return config;
  },
};

/**
 * PWA/Service-Worker bewusst DEAKTIVIERT.
 * Alte Registrierungen werden zur Laufzeit unregistriert (UnregisterServiceWorkers).
 */
function withOptionalPWA(config: NextConfig): NextConfig {
  if (process.env.NODE_ENV === "development") {
    return config;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const withPWAInit = require("@ducanh2912/next-pwa").default as typeof import("@ducanh2912/next-pwa").default;

  const withPWA = withPWAInit({
    dest: "public",
    disable: true,
    register: false,
    workboxOptions: {
      disableDevLogs: true,
      runtimeCaching: [
        {
          urlPattern: /\/_next\/static\/chunks\/.*/i,
          handler: "NetworkOnly" as const,
        },
        {
          urlPattern: /\/_next\/static\/.*/i,
          handler: "NetworkOnly" as const,
        },
        {
          urlPattern: ({ url }: { url: URL }) =>
            url.hostname.endsWith("supabase.co") || url.hostname.includes("supabase"),
          handler: "NetworkOnly" as const,
        },
      ],
    },
  });

  return withPWA(config);
}

export default withOptionalPWA(nextConfig);
