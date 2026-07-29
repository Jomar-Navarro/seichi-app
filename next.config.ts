import type { NextConfig } from "next";

// Gli avatar sono serviti dallo Storage di Supabase: next/image accetta host
// remoti solo se dichiarati esplicitamente.
//
// Se la variabile manca falliamo qui invece di degradare a `remotePatterns: []`:
// quella lista vuota farebbe compilare tutto e poi esplodere a runtime dentro
// next/image, mandando in 500 la dashboard e ogni pagina impostazioni per
// chiunque abbia un avatar. Meglio un errore esplicito di configurazione.
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL non è definita: serve a autorizzare l'host degli avatar in next/image. Controlla .env.local (o le env del deploy).",
  );
}

const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname;

const nextConfig: NextConfig = {
  allowedDevOrigins: ["172.30.224.1", "192.168.1.224", "192.168.1.*"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHost,
        pathname: "/storage/v1/object/public/avatars/**",
      },
    ],
  },
};

export default nextConfig;
