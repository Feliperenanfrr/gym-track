"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Trash2 } from "lucide-react"
import { Card, PageHeader, Skeleton } from "@/components/ui"
import { EXERCISES_BY_ID, PLAN_BY_ID } from "@/lib/plan"
import { useGymData } from "@/lib/store"
import { cn, formatKg, fromDateKey, workoutVolume } from "@/lib/utils"

export default function Historico() {
  const { data, error, deleteWorkout } = useGymData()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const workouts = useMemo(() => {
    if (!data) return []
    return [...data.workouts].sort((a, b) => b.date.localeCompare(a.date))
  }, [data])

  const handleDelete = async (id: string, date: string, sessionId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este treino? Essa ação não pode ser desfeita.")) {
      return
    }
    setDeletingId(id)
    try {
      await deleteWorkout(id, date, sessionId)
    } finally {
      setDeletingId(null)
    }
  }

  if (error) {
    return (
      <main>
        <PageHeader kicker="HISTÓRICO" title="Treinos" />
        <Card className="border-l-4 border-l-ember text-sm text-steel">
          Erro ao carregar do banco: {error}
        </Card>
      </main>
    )
  }

  if (!data) {
    return (
      <main>
        <PageHeader kicker="HISTÓRICO" title="Treinos" />
        <Card className="mb-4"><Skeleton className="h-24 w-full" /></Card>
        <Card className="mb-4"><Skeleton className="h-24 w-full" /></Card>
        <Card className="mb-4"><Skeleton className="h-24 w-full" /></Card>
      </main>
    )
  }

  return (
    <main className="pb-10">
      <PageHeader
        kicker="REGISTROS"
        title="Histórico"
        left={
          <Link href="/" className="mb-1 text-steel transition-colors hover:text-bone">
            <ArrowLeft size={20} />
          </Link>
        }
      />

      <div className="flex flex-col gap-3">
        {workouts.length === 0 ? (
          <p className="text-center text-sm text-steel-dim py-10">Nenhum treino registrado ainda.</p>
        ) : (
          workouts.map((w, i) => {
            const date = fromDateKey(w.date)
            const session = PLAN_BY_ID[w.sessionId]
            const volume = workoutVolume(w)
            const cardioLabel =
              w.cardio?.purpose === "intense"
                ? "intenso"
                : w.cardio?.purpose === "sport" || w.sessionId === "sport"
                  ? "esporte"
                  : "Zona 2"
            
            return (
              <Card key={w.id} className={cn("rise", `rise-${Math.min(6, i + 1)}`, "relative overflow-hidden")}>
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-steel" style={{ fontFamily: "var(--font-condensed)" }}>
                      {date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
                    </p>
                    <h3 className="stencil mt-1 text-xl text-bone">
                      {session?.title || "Sessão Desconhecida"}
                    </h3>
                    <p className="mt-1 font-mono text-xs text-steel-dim">
                      {w.entries.length} exercícios {volume > 0 && `· ${formatKg(volume)} total`} {w.cardio && `· ${w.cardio.minutes} min ${w.cardio.mode} (${cardioLabel})`}
                    </p>
                    {w.entries.length > 0 && (
                      <ul className="mt-3 space-y-1 border-t border-seam pt-3">
                        {w.entries.map((entry) => (
                          <li key={entry.exerciseId} className="flex justify-between gap-3 text-xs">
                            <span className="text-steel">
                              {entry.exerciseName ?? EXERCISES_BY_ID[entry.exerciseId]?.name ?? entry.exerciseId}
                            </span>
                            <span className="shrink-0 font-mono text-steel-dim">
                              {entry.sets.length} séries
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(w.id, w.date, w.sessionId)}
                    disabled={deletingId === w.id}
                    className="p-2 text-steel-dim hover:text-ember transition-colors disabled:opacity-50"
                    aria-label="Excluir treino"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </Card>
            )
          })
        )}
      </div>
    </main>
  )
}
