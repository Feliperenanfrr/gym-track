import { WifiOff } from "lucide-react"

export default function OfflinePage() {
  return (
    <main className="flex min-h-[70dvh] flex-col items-center justify-center text-center">
      <div className="rise">
        <WifiOff size={40} className="mx-auto text-steel-dim" />
        <h1 className="stencil mt-4 text-3xl text-bone">Sem conexão</h1>
        <p className="mt-2 max-w-xs text-sm text-steel">
          Você está offline. O que registrar agora fica salvo no aparelho e
          sincroniza sozinho quando a rede voltar.
        </p>
        <p className="mt-4 font-mono text-[10px] text-steel-dim">
          GYM//TRACK
        </p>
      </div>
    </main>
  )
}
