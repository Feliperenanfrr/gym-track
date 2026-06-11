"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ClipboardList, Dumbbell, Flame, Ruler } from "lucide-react"
import { cn } from "@/lib/utils"

const ITEMS = [
  { href: "/", label: "HOJE", icon: Flame },
  { href: "/treino", label: "TREINO", icon: Dumbbell },
  { href: "/plano", label: "PLANO", icon: ClipboardList },
  { href: "/medidas", label: "MEDIDAS", icon: Ruler },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-seam bg-coal/90 backdrop-blur-md">
      <div className="hazard h-0.5 w-full opacity-60" />
      <div className="mx-auto flex max-w-md items-stretch md:max-w-2xl">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-3 transition-colors",
                active ? "text-ember" : "text-steel-dim hover:text-steel"
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
              <span
                className="text-[10px] font-semibold tracking-[0.2em]"
                style={{ fontFamily: "var(--font-condensed)" }}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
