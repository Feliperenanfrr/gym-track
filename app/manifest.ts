import type { MetadataRoute } from "next"

export const dynamic = "force-static"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GYM//TRACK — Felipe",
    short_name: "GYM//TRACK",
    description:
      "Tracker do plano de treino: Upper/Lower, Zona 2 e recomposição corporal",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0a0c",
    theme_color: "#0b0a0c",
    orientation: "portrait",
    lang: "pt-BR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
