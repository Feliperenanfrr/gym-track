import { resolve } from "node:path"
import { defineConfig } from "vitest/config"

/**
 * Só existe para dar o alias "@/" aos testes: as folhas de relatório importam
 * por ele, e sem isso os componentes ficariam fora do alcance da suíte — que
 * até aqui só cobria `lib/`.
 */
export default defineConfig({
  resolve: { alias: { "@": resolve(import.meta.dirname, ".") } },
})
