"use client"

import { ArrowLeftRight } from "lucide-react"
import { formatKgApprox, inputToKg, LoadUnit } from "@/lib/units"
import { cn } from "@/lib/utils"

interface LoadFieldProps {
  id: string
  /** 1, 2, 3… — para o leitor de tela */
  setNumber: number
  /** texto cru do campo, na unidade da placa */
  value: string
  loadUnit: LoadUnit
  /** isometria: a carga é extra e opcional ("+kg") */
  optional?: boolean
  onChange: (value: string) => void
  onToggleUnit: () => void
  /** Enter / "próximo" do teclado: pula para as reps da série */
  onNext: () => void
}

/**
 * Campo de carga da série. A unidade embaixo é um botão: pilha em lb digita
 * lb e o app grava kg — sem conta de cabeça no meio da série. Em lb, o
 * equivalente em kg aparece enquanto você digita.
 */
export function LoadField({
  id,
  setNumber,
  value,
  loadUnit,
  optional = false,
  onChange,
  onToggleUnit,
  onNext,
}: LoadFieldProps) {
  const lb = loadUnit === "lb"
  const kg = inputToKg(parseFloat(value.replace(",", ".")), loadUnit)

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        enterKeyHint="next"
        step={lb ? "1" : "0.5"}
        placeholder="–"
        aria-label={`Carga da série ${setNumber} em ${lb ? "libras" : "quilos"}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            onNext()
          }
        }}
        className={cn(
          "w-full rounded-md border bg-coal py-2.5 text-center font-mono text-lg text-bone outline-none focus:border-ember",
          lb ? "border-gold/40" : "border-seam"
        )}
      />
      <button
        type="button"
        onClick={onToggleUnit}
        className={cn(
          "flex h-6 items-center justify-center gap-1 rounded font-mono text-[10px] uppercase tracking-wide transition-colors active:scale-95",
          lb ? "text-gold" : "text-steel-dim hover:text-bone"
        )}
        aria-label={
          lb
            ? "Carga em libras, gravada em kg. Tocar para digitar em quilos"
            : "Carga em quilos. Tocar para digitar em libras"
        }
      >
        {optional ? "+" : ""}
        {loadUnit}
        {lb && kg > 0 ? (
          <span className="normal-case text-steel">≈{formatKgApprox(kg)} kg</span>
        ) : (
          <ArrowLeftRight size={10} aria-hidden />
        )}
      </button>
    </div>
  )
}
