# @openfeedback/cli

Herramienta de línea de comandos para OpenFeedback Engine. Permite sincronizar el estado de las sugerencias desde un archivo `ROADMAP.md` local hacia la base de datos, y escanear el historial de git para detectar commits que referencian sugerencias (base para la generación automática de changelogs).

## Instalación

El paquete se encuentra en `packages/cli` dentro del monorepo. Para compilarlo:

```bash
pnpm --filter @openfeedback/cli build
```

Tras la compilación, el binario queda disponible en `packages/cli/dist/index.js` y se registra como el ejecutable `openfeedback` en el campo `bin` del `package.json`.

Para enlazarlo globalmente durante el desarrollo:

```bash
# Desde la raíz del monorepo
pnpm --filter @openfeedback/cli build
cd packages/cli
pnpm link --global
```

Después se puede invocar directamente:

```bash
openfeedback --help
openfeedback --version
```

## Variables de entorno

El comando `sync` requiere las siguientes variables para conectarse a Supabase. Sin ellas, el proceso terminará con un error indicando cuáles faltan.

| Variable                    | Descripción                                                                 | Ejemplo                                     |
| --------------------------- | --------------------------------------------------------------------------- | ------------------------------------------- |
| `OPENFEEDBACK_API_URL`      | URL base del proyecto Supabase                                              | `https://xyzcompany.supabase.co`            |
| `OPENFEEDBACK_SERVICE_KEY`  | Clave `service_role` de Supabase (bypasses RLS, nunca exponer en el cliente) | `eyJhbGciOiJIUzI1NiIs...`                   |
| `OPENFEEDBACK_PROJECT_ID`   | UUID del proyecto en la tabla `projects`                                    | `a1b2c3d4-e5f6-7890-abcd-ef1234567890`     |

Se recomienda usar un archivo `.env` local (excluido de git) o exportar las variables en la sesión de shell antes de ejecutar el comando.

```bash
export OPENFEEDBACK_API_URL="https://xyzcompany.supabase.co"
export OPENFEEDBACK_SERVICE_KEY="eyJhbGci..."
export OPENFEEDBACK_PROJECT_ID="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

> **Seguridad:** la clave `service_role` tiene acceso total a la base de datos. No la incluyas en código cliente ni en repositorios públicos.

---

## Comandos

### `openfeedback sync`

Sincroniza el estado de las sugerencias definidas en un archivo `ROADMAP.md` con la base de datos de Supabase.

```
Usage: openfeedback sync [options] [file]

Sync ROADMAP.md suggestion statuses with the database

Arguments:
  file        Path to ROADMAP.md (default: "ROADMAP.md")

Options:
  --dry-run   Show what would change without writing to the database
  -h, --help  display help for command
```

#### Formato del archivo ROADMAP.md

El archivo sigue una convención de Markdown donde los encabezados (`##`) determinan el estado y los elementos de lista (`-` o `*`) representan sugerencias individuales. Cada sugerencia debe incluir un ancla HTML con el UUID de la base de datos:

```markdown
# Roadmap

## Planned
- Soporte para modo oscuro <!-- id: a1b2c3d4-e5f6-7890-abcd-ef1234567890 -->
- Exportación a CSV <!-- id: b2c3d4e5-f6a7-8901-bcde-f12345678901 -->

## In Progress
- Notificaciones en tiempo real <!-- id: c3d4e5f6-a7b8-9012-cdef-123456789012 -->

## Shipped
- Sistema de votación <!-- id: d4e5f6a7-b8c9-0123-defa-234567890123 -->

## Closed
- Integración legacy descartada <!-- id: e5f6a7b8-c9d0-1234-efab-345678901234 -->
```

El ancla tiene el formato `<!-- id: <uuid> -->` donde `<uuid>` es el identificador de 36 caracteres (formato estándar UUID v4) de la sugerencia en la tabla `suggestions`.

#### Mapeo de encabezados a estados

El parser reconoce los siguientes encabezados (case-insensitive) y los traduce al campo `status` de la tabla `suggestions`:

| Encabezado      | Estado resultante |
| --------------- | ----------------- |
| `Open`          | `open`            |
| `Backlog`       | `open`            |
| `Planned`       | `planned`         |
| `In Progress`   | `in_progress`     |
| `In-Progress`   | `in_progress`     |
| `Shipped`       | `shipped`         |
| `Done`          | `shipped`         |
| `Completed`     | `shipped`         |
| `Closed`        | `closed`          |
| `Rejected`      | `closed`          |

Los encabezados soportan niveles `#`, `##` y `###`. Si un encabezado no coincide con ninguno de los anteriores, el estado actual se mantiene (por defecto `open` al inicio del documento).

Las sugerencias sin ancla `<!-- id: ... -->` se ignoran silenciosamente.

#### Modo dry-run

Ejecutar con `--dry-run` parsea el archivo y muestra las entradas detectadas sin conectar con la base de datos. No requiere variables de entorno.

```bash
openfeedback sync --dry-run
```

Salida de ejemplo:

```
Reading roadmap from /home/user/project/ROADMAP.md...
Found 4 suggestion(s) in roadmap.

Dry run — parsed entries:
  [planned] Soporte para modo oscuro (a1b2c3d4-e5f6-7890-abcd-ef1234567890)
  [planned] Exportación a CSV (b2c3d4e5-f6a7-8901-bcde-f12345678901)
  [in_progress] Notificaciones en tiempo real (c3d4e5f6-a7b8-9012-cdef-123456789012)
  [shipped] Sistema de votación (d4e5f6a7-b8c9-0123-defa-234567890123)
```

#### Sincronización real

Sin `--dry-run`, el comando:

1. Lee y parsea el archivo `ROADMAP.md`.
2. Obtiene todas las sugerencias del proyecto desde la API REST de Supabase (`GET /rest/v1/suggestions`).
3. Compara el estado local (del markdown) con el remoto (de la base de datos).
4. Actualiza via `PATCH` solo las sugerencias cuyo estado ha cambiado.
5. Informa de las sugerencias no encontradas en la base de datos (IDs del markdown que no existen remotamente).

```bash
openfeedback sync
```

Salida de ejemplo:

```
Reading roadmap from /home/user/project/ROADMAP.md...
Found 4 suggestion(s) in roadmap.

Updated:
  Soporte para modo oscuro — open → planned
  Sistema de votación — in_progress → shipped

Not found in database (skipped):
  Exportación a CSV (b2c3d4e5-f6a7-8901-bcde-f12345678901)

Sync complete: 2 updated, 1 unchanged, 1 not found.
```

#### Archivo alternativo

Se puede indicar un archivo distinto a `ROADMAP.md`:

```bash
openfeedback sync docs/roadmap-publico.md
openfeedback sync --dry-run ./mi-roadmap.md
```

---

### `openfeedback changelog`

Escanea el historial de commits de git en busca de referencias a IDs de sugerencias de OpenFeedback. Agrupa los resultados por sugerencia para facilitar la generación de changelogs.

```
Usage: openfeedback changelog [options]

Scan git commits for OpenFeedback suggestion references

Options:
  --since <ref>  Start from this git ref or date (e.g. v0.1.0, 2024-01-01)
  --until <ref>  End at this git ref (default: HEAD) (default: "HEAD")
  --json         Output as JSON instead of human-readable text
  -h, --help     display help for command
```

#### Patrones de referencia reconocidos

El scanner busca los siguientes patrones en los mensajes de commit (case-insensitive). El UUID debe ser un UUID v4 completo de 36 caracteres:

| Patrón                  | Tipo detectado | Ejemplo en commit                                            |
| ----------------------- | -------------- | ------------------------------------------------------------ |
| `[OF-<uuid>]`          | `tag`          | `feat: dark mode [OF-a1b2c3d4-e5f6-7890-abcd-ef1234567890]` |
| `OF-<uuid>`            | `mention`      | `refactor related to OF-a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| `fix(es) #<uuid>`      | `fixes`        | `fix: color contrast fixes #a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| `close(s) #<uuid>`     | `closes`       | `feat: implement feature closes #a1b2c3d4-...`              |
| `resolve(s) #<uuid>`   | `resolves`     | `resolves #a1b2c3d4-...`                                    |
| `ref #<uuid>`          | `ref`          | `docs: update readme ref #a1b2c3d4-...`                     |

Cuando un mismo UUID es detectado por múltiples patrones, se mantiene el más específico (orden de prioridad: tag > fixes > closes > resolves > ref > mention).

#### Filtrar por rango

```bash
# Commits desde un tag hasta HEAD
openfeedback changelog --since v0.1.0

# Commits entre dos tags
openfeedback changelog --since v0.1.0 --until v0.2.0

# Commits desde una fecha
openfeedback changelog --since 2025-01-01
```

Sin `--since`, se escanea todo el historial del repositorio.

#### Salida legible

```bash
openfeedback changelog --since v0.1.0
```

```
Found 3 commit(s) referencing 2 suggestion(s):

  Suggestion a1b2c3d4-e5f6-7890-abcd-ef1234567890:
    abcd1234 feat: dark mode [OF-a1b2c3d4-e5f6-7890-abcd-ef1234567890] (tag, 2025-06-15T10:30:00+02:00)
    efgh5678 fix: dark mode contrast fixes #a1b2c3d4-e5f6-7890-abcd-ef1234567890 (fixes, 2025-06-16T14:20:00+02:00)

  Suggestion c3d4e5f6-a7b8-9012-cdef-123456789012:
    ijkl9012 feat: notifications closes #c3d4e5f6-a7b8-9012-cdef-123456789012 (closes, 2025-06-17T09:00:00+02:00)
```

#### Salida JSON

Para integración con scripts o pipelines de CI/CD:

```bash
openfeedback changelog --since v0.1.0 --json
```

```json
[
  {
    "hash": "abcd1234efgh5678ijkl9012mnop3456qrst7890",
    "message": "feat: dark mode [OF-a1b2c3d4-e5f6-7890-abcd-ef1234567890]",
    "date": "2025-06-15T10:30:00+02:00",
    "suggestionIds": ["a1b2c3d4-e5f6-7890-abcd-ef1234567890"],
    "refType": "tag"
  }
]
```

Cada objeto del array contiene:

| Campo            | Tipo       | Descripción                                                     |
| ---------------- | ---------- | --------------------------------------------------------------- |
| `hash`           | `string`   | Hash completo del commit (40 caracteres)                        |
| `message`        | `string`   | Primera línea del mensaje de commit                             |
| `date`           | `string`   | Fecha del commit en formato ISO 8601                            |
| `suggestionIds`  | `string[]` | UUIDs de las sugerencias referenciadas en ese commit            |
| `refType`        | `string`   | Tipo de la referencia principal: `tag`, `fixes`, `closes`, `resolves`, `ref`, `mention` |

---

## Arquitectura interna

```
packages/cli/src/
  index.ts              # Punto de entrada: registra comandos y ejecuta commander
  roadmap-parser.ts     # Parser del formato ROADMAP.md → RoadmapEntry[]
  git-refs.ts           # Detección de referencias a sugerencias en commits de git
  commands/
    sync.ts             # Comando `sync`: lee roadmap, compara con DB, actualiza
    changelog.ts        # Comando `changelog`: escanea git log, agrupa por sugerencia
```

### roadmap-parser.ts

Módulo independiente que exporta dos funciones:

- `parseRoadmap(filePath)` — Lee el archivo del disco y delega al parser.
- `parseRoadmapContent(content)` — Parsea un string de Markdown. Útil para testing sin acceso al filesystem.

Ambas devuelven un array de `RoadmapEntry`:

```typescript
interface RoadmapEntry {
  id: string;                  // UUID de la sugerencia
  title: string;               // Texto del ítem (sin el ancla HTML)
  status: SuggestionStatusType; // "open" | "planned" | "in_progress" | "shipped" | "closed"
}
```

El tipo `SuggestionStatusType` se importa desde `@openfeedback/client`, garantizando que los estados son siempre consistentes con el esquema Zod de la base de datos.

### git-refs.ts

Módulo independiente que exporta:

- `extractRefs(message)` — Extrae referencias de un string (un mensaje de commit). Devuelve un array deduplicado de `{ id, type }`.
- `scanCommitRefs(options?)` — Ejecuta `git log` con formato personalizado y filtra los commits que contienen referencias. Devuelve un array de `CommitRef`.

```typescript
interface CommitRef {
  hash: string;            // Hash completo del commit
  message: string;         // Primera línea del mensaje
  date: string;            // Fecha ISO 8601
  suggestionIds: string[]; // UUIDs referenciados
  refType: "tag" | "fixes" | "closes" | "resolves" | "ref" | "mention";
}
```

La detección usa expresiones regulares evaluadas en orden de prioridad. Si un UUID coincide con múltiples patrones (e.g., `[OF-<uuid>]` contiene tanto el patrón `tag` como `mention`), se registra solo la coincidencia más específica.

### Flujo del comando sync

```
ROADMAP.md
    │
    ▼
parseRoadmap()  ──►  RoadmapEntry[]
                         │
                         ▼
              fetchRemoteSuggestions()  ──►  Sugerencias remotas (DB)
                         │
                         ▼
                    Comparación por ID
                    ┌─────────────────────────┐
                    │ Mismo estado → unchanged │
                    │ Distinto    → PATCH      │
                    │ No existe   → notFound   │
                    └─────────────────────────┘
                         │
                         ▼
                   Resumen en consola
```

### Flujo del comando changelog

```
git log --format="%H%n%s%n%aI%n---"
    │
    ▼
scanCommitRefs()
    │
    ├── Para cada commit: extractRefs(message)
    │       │
    │       ▼
    │   Patrones regex evaluados en orden de prioridad
    │   Deduplicación por UUID
    │
    ▼
CommitRef[] (solo commits con ≥1 referencia)
    │
    ▼
Agrupación por suggestion ID → salida legible o JSON
```

---

## Build y desarrollo

```bash
# Compilar solo la CLI (requiere que @openfeedback/client esté compilado)
pnpm --filter @openfeedback/client build
pnpm --filter @openfeedback/cli build

# Compilar todo el monorepo (Turborepo resuelve el orden de dependencias)
pnpm build

# Modo watch para desarrollo
pnpm --filter @openfeedback/cli dev

# Verificar tipos sin compilar
pnpm --filter @openfeedback/cli type-check
```

La CLI se compila con `tsup` en formato ESM. El banner `#!/usr/bin/env node` se inyecta automáticamente para que el archivo resultante sea ejecutable directamente como script de Node.js.

### Dependencias

| Paquete                  | Propósito                                                   |
| ------------------------ | ----------------------------------------------------------- |
| `commander`              | Framework para parsing de argumentos y registro de comandos |
| `@openfeedback/client`   | Tipos compartidos (`SuggestionStatusType`) derivados de los esquemas Zod |

---

## Convenciones para mensajes de commit

Para que `openfeedback changelog` detecte las referencias correctamente, incluye el UUID de la sugerencia en el mensaje de commit usando cualquiera de estos formatos:

```bash
# Formato recomendado: tag explícito
git commit -m "feat: implement dark mode [OF-a1b2c3d4-e5f6-7890-abcd-ef1234567890]"

# Formato GitHub-style
git commit -m "fix: contrast ratio fixes #a1b2c3d4-e5f6-7890-abcd-ef1234567890"
git commit -m "feat: real-time updates closes #c3d4e5f6-a7b8-9012-cdef-123456789012"

# Referencia genérica
git commit -m "docs: update API docs ref #a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

Un commit puede referenciar múltiples sugerencias:

```bash
git commit -m "feat: batch export [OF-aaaa...] closes #bbbb..."
```
