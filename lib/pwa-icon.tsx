import { ImageResponse } from "next/og"

/**
 * Ícone do app desenhado só com divs (sem fonte) — um haltere ember sobre
 * fundo carvão. Compartilhado pelas rotas /icon-192.png e /icon-512.png.
 * A área central é mantida segura para ícones maskable.
 */
export function renderIcon(size: number) {
  const u = size / 512 // escala relativa ao desenho base de 512
  const plateH = 240 * u
  const plateW = 60 * u
  const barW = 150 * u
  const barH = 56 * u
  const radius = 18 * u

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0a0c",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: plateW,
              height: plateH,
              background: "#ff5a1f",
              borderRadius: radius,
            }}
          />
          <div
            style={{
              width: 22 * u,
              height: 90 * u,
              background: "#ff7a45",
            }}
          />
          <div
            style={{ width: barW, height: barH, background: "#ff5a1f" }}
          />
          <div
            style={{
              width: 22 * u,
              height: 90 * u,
              background: "#ff7a45",
            }}
          />
          <div
            style={{
              width: plateW,
              height: plateH,
              background: "#ff5a1f",
              borderRadius: radius,
            }}
          />
        </div>
      </div>
    ),
    { width: size, height: size }
  )
}
