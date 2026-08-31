#!/usr/bin/env bash
# Backup lógico do banco Supabase — funciona no plano Free (que não tem backup automático).
#
#   pnpm backup                 # usa SUPABASE_DB_URL do .env.local
#   SUPABASE_DB_URL="postgresql://..." bash scripts/backup-supabase.sh
#
# Gera backups/<data>/{roles,schema,data}.sql. Precisa de Docker rodando
# (a CLI do Supabase executa o pg_dump na versão certa do Postgres dentro de um container).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ -z "${SUPABASE_DB_URL:-}" ] && [ -f .env.local ]; then
  SUPABASE_DB_URL="$(grep -E '^SUPABASE_DB_URL=' .env.local | head -1 | cut -d '=' -f 2- | tr -d '"'"'" | tr -d '\r')"
fi

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  cat >&2 <<'MSG'
Falta a connection string do banco.

Pegue em: Dashboard > Project Settings > Database > Connection string > Session pooler
(use o Session pooler: a conexão direta é só IPv6 no plano Free)

E salve no .env.local:
  SUPABASE_DB_URL=postgresql://postgres.<project-ref>:<senha>@aws-0-<regiao>.pooler.supabase.com:5432/postgres
MSG
  exit 1
fi

case "$SUPABASE_DB_URL" in
  *"[YOUR-PASSWORD]"*|*"<senha>"*)
    echo "SUPABASE_DB_URL ainda tem o placeholder da senha — troque pela senha real do banco." >&2
    exit 1
    ;;
esac

if ! docker info >/dev/null 2>&1; then
  echo "Docker não está rodando. Abra o Docker Desktop e tente de novo." >&2
  exit 1
fi

STAMP="$(date +%Y-%m-%d_%H%M)"
OUT="backups/$STAMP"
mkdir -p "$OUT"

dump() {
  echo ">> $1"
  shift
  npx --yes supabase@latest db dump --db-url "$SUPABASE_DB_URL" "$@"
}

dump "roles"  -f "$OUT/roles.sql"  --role-only
dump "schema" -f "$OUT/schema.sql"
dump "data"   -f "$OUT/data.sql"   --data-only --use-copy \
  -x "storage.buckets_vectors" -x "storage.vector_indexes"

{
  echo "projeto:  gym-track"
  echo "gerado:   $(date -Iseconds)"
  echo "commit:   $(git rev-parse --short HEAD 2>/dev/null || echo 'n/a')"
  echo "linhas:   $(wc -l < "$OUT/data.sql") em data.sql"
} > "$OUT/MANIFEST.txt"

echo
echo "Backup em $OUT:"
ls -lh "$OUT" | tail -n +2
echo
echo "Guarde uma cópia FORA desta máquina (Drive, HD externo). São dados de saúde: não commite."
