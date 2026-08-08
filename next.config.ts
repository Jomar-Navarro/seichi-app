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

// Stessa logica per l'URL pubblico dell'app: è la base dei link spediti per
// email (conferma registrazione, recupero password, cambio email). Il controllo
// vive QUI e non solo in lib/site-url.ts perché le NEXT_PUBLIC_* vengono
// sostituite come costanti in fase di compilazione: un throw dentro un modulo
// applicativo scatterebbe alla prima esecuzione dell'action, cioè addosso a un
// utente, mentre next.config.ts gira durante il build e fa fallire il deploy.
if (!process.env.NEXT_PUBLIC_SITE_URL) {
  throw new Error(
    "NEXT_PUBLIC_SITE_URL non è definita: è la base dei link inviati per email (conferma registrazione, recupero password, cambio email). Senza, l'app spedirebbe link a localhost senza segnalare nulla. Controlla .env.local (o le env del deploy).",
  );
}

const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname;

const nextConfig: NextConfig = {
  allowedDevOrigins: ["172.30.224.1", "192.168.1.224", "192.168.1.*"],
  experimental: {
    serverActions: {
      // L'avatar viaggia in una server action, e il limite di default è 1 MB:
      // senza questo, ogni immagine tra 1 e 2 MB verrebbe rifiutata dal
      // framework PRIMA di entrare in uploadAvatar, che invece ne accetta 2 MB
      // (come il bucket e come la scritta "massimo 2 MB" nella UI).
      // 3 MB e non 2: il limite vale sul body HTTP grezzo, quindi comprende
      // boundary e header del multipart che si aggiungono al file.
      bodySizeLimit: "3mb",
    },
  },
  // ⚠️ Le rotte che scambiano credenziali NON devono essere memorizzabili.
  //
  // `@supabase/ssr` passa a `setAll` un secondo argomento con le direttive di
  // cache da mettere sulla risposta, e la sua documentazione spiega perché:
  // *"Responses that set auth cookies must not be cached by CDNs or reverse
  // proxies, otherwise one user's session token can be served to a different
  // user."* Il proxy quelle direttive le applica (vedi lib/supabase/proxy.ts).
  //
  // `lib/supabase/server.ts` NON può: dentro un Server Component `cookies()` non
  // ha un canale per gli header di risposta, e in un Route Handler il client
  // viene creato prima che la `Response` esista. Passare il parametro a valle
  // non è quindi una modifica di quel file — è una modifica di ogni handler.
  //
  // Queste sono le quattro rotte che scrivono cookie di sessione fuori dal
  // proxy: /callback (exchangeCodeForSession), /auth/confirm (verifyOtp) e i due
  // signout. Dichiararle qui copre il buco in un punto solo, e resta valido
  // anche se un domani un handler cambia implementazione.
  async headers() {
    return [
      {
        source: "/:path(callback|signout|auth/signout|auth/confirm)",
        headers: [
          { key: "Cache-Control", value: "private, no-cache, no-store, must-revalidate, max-age=0" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
    ];
  },
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
