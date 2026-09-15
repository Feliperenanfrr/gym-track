// Roda um arquivo .sql contra o projeto via Management API, usando o
// SUPABASE_ACCESS_TOKEN do .env.local (mesmo mecanismo do scripts/backup-supabase.mjs).
//
//   pnpm sql supabase/migrations/0010_correct_futebol_society_e_plank_pull_through_2026_09_15.sql
import { readFileSync, existsSync } from 'node:fs'

const env = { ...process.env }
if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (m && !env[m[1]]) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

const token = env.SUPABASE_ACCESS_TOKEN
const ref = (env.SUPABASE_PROJECT_REF || env.NEXT_PUBLIC_SUPABASE_URL || '').match(/[a-z]{20}/)?.[0]
if (!token) fatal('Falta SUPABASE_ACCESS_TOKEN no .env.local (Dashboard > Account > Access Tokens).')
if (!ref) fatal('Não consegui deduzir o project ref de NEXT_PUBLIC_SUPABASE_URL.')

const file = process.argv[2]
if (!file) fatal('Uso: pnpm sql <caminho-do-arquivo.sql>')
if (!existsSync(file)) fatal(`Arquivo não encontrado: ${file}`)

const query = readFileSync(file, 'utf8')

const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  body: JSON.stringify({ query }),
})
const body = await r.json()
if (!r.ok) fatal(`SQL falhou (${r.status}): ${body.message || JSON.stringify(body).slice(0, 400)}`)

console.log(`OK — ${file} executado.`)
if (Array.isArray(body) && body.length) console.log(JSON.stringify(body, null, 2))

function fatal(m) { console.error(m); process.exit(1) }
