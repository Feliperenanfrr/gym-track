"use client"

import { useEffect, useRef } from "react"
import { RotateCcw, TriangleAlert, X } from "lucide-react"

/**
 * Diálogo de confirmação próprio (bottom sheet): substitui o confirm nativo
 * do browser, que quebra o padrão visual e não existe em PWA iOS standalone.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Excluir",
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-coal/80 px-4 backdrop-blur-sm"
      style={{ paddingBottom: "calc(68px + env(safe-area-inset-bottom))" }}
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="rise w-full max-w-md rounded-lg border border-seam bg-iron p-4 shadow-[0_-6px_32px_rgba(0,0,0,0.6)] md:max-w-lg"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-start gap-2.5">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-gold" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-bone">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-steel">{message}</p>
          </div>
          <button
            onClick={onCancel}
            className="shrink-0 rounded p-1 text-steel-dim transition-colors hover:text-bone"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded border border-seam px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-steel transition-colors hover:text-bone"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="rounded bg-red-500 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-red-600"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Snackbar de desfazer para exclusões: a deleção acontece na hora, mas o
 * registro volta com um tap enquanto o aviso está na tela.
 */
export function UndoToast({
  message,
  onUndo,
  onDismiss,
}: {
  message: string
  onUndo: () => void
  onDismiss: () => void
}) {
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(onDismiss, 6500)
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [message, onDismiss])

  return (
    <div
      className="fixed inset-x-0 z-[65] flex justify-center px-4"
      style={{ bottom: "calc(76px + env(safe-area-inset-bottom))" }}
      role="status"
    >
      <div className="flex w-full max-w-md items-center gap-2 rounded-lg border border-seam bg-iron/95 px-3 py-2.5 shadow-[0_6px_24px_rgba(0,0,0,0.5)] backdrop-blur md:max-w-xl">
        <span className="min-w-0 flex-1 truncate text-xs text-steel">{message}</span>
        <button
          onClick={onUndo}
          className="flex shrink-0 items-center gap-1.5 rounded border border-gold/40 bg-gold/10 px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-gold transition-colors hover:bg-gold/20"
        >
          <RotateCcw size={12} /> Desfazer
        </button>
      </div>
    </div>
  )
}
