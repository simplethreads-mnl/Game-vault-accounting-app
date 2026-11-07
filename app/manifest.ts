import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Game Vault",
    short_name: "Game Vault",
    description: "Books, stock and repairs for your Switch & iPhone business",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0d0d0d",
    theme_color: "#6250d6",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
