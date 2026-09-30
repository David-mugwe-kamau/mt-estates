import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MT Estates",
    short_name: "MT Estates",
    description: "Rentals, Airbnbs, listings, and property billing in Kenya.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F8FAFC",
    theme_color: "#005B8E",
    lang: "en",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
