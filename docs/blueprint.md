# OpenFeedback Engine: Project Blueprint

> **Tagline:** La infraestructura de feedback "Headless" para el ecosistema moderno de Next.js.
> **Version:** 2.0.0
> **Estado:** Fase 2 completada — Core Engine implementado
> **Licencia:** MIT (Core) / Comercial (Managed Services)

---

## 1. Resumen Ejecutivo

**OpenFeedback Engine** no es otro portal de feedback. Es una infraestructura de codigo abierto disenada para desarrolladores que desean integrar la recoleccion de feedback, votaciones y roadmaps directamente en sus aplicaciones SaaS, sin sacrificar su identidad visual ni obligar a los usuarios a crear cuentas externas.

A diferencia de las soluciones monoliticas (Canny, Jira PD), OpenFeedback funciona como un conjunto de primitivas (SDKs y APIs) que se integran en el ciclo de vida de desarrollo (Git), automatizando la comunicacion con el usuario (Changelogs) y garantizando la soberania de los datos (GDPR-first).

## 2. Analisis del Problema (The Pain)

Los fundadores de SaaS y desarrolladores Indie enfrentan un trilema con las herramientas actuales:

*   **Friccion de Usuario:** Herramientas externas requieren que el usuario se registre nuevamente para votar. Resultado: Baja participacion (<5% de los usuarios).
*   **Incoherencia Visual:** Los "Feedback Boards" externos (iframe o subdominio) rompen la experiencia de usuario y la marca.
*   **Sobrecosto y Riesgo de Privacidad:** Soluciones Enterprise son caras y centralizadas. Almacenar datos de usuarios europeos en servidores de terceros (EE. UU.) complica el cumplimiento del **GDPR**.
*   **Desconexion del Flujo de Trabajo:** El feedback vive en un silo. Cerrar el ciclo ("Shipping it") depende de procesos manuales propensos al error humano.

## 3. La Solucion (The Gain)

Un sistema **Headless** y **Self-Hosted** que vive dentro de tu aplicacion.

### Principios de Diseno

1.  **Signed Stateless Auth:** Autenticacion criptografica sin estado. El backend valida firma HMAC-SHA256, timestamp y nonce (protegido por Set bounded en RAM con eviccion FIFO).
2.  **Pseudonymous Vault:** Honestidad en privacidad. El voto es publico y anonimo; el email se guarda encriptado en una tabla aislada para notificaciones "Just-In-Time".
3.  **Developer Experience (DX) Obsessive:** Disenado para Next.js (App Router, Server Actions). Se instala con `npm install @openfeedback/react @openfeedback/client`.
4.  **Headless con Theme Opcional:** Funciona directo de la caja importando `@openfeedback/react/styles.css`. Personalizable, pero bonito por defecto.
5.  **No-Black-Magic:** Nada de "Git-Write-Back" automaticos en CI. El desarrollador controla la sincronizacion con `openfeedback sync`.

## 4. Stack Tecnico

### 4.1 Frontend (El SDK)
*   **Lenguaje:** TypeScript (strict, sin `any`).
*   **Framework Objetivo:** React 18/19, Next.js (App Router).
*   **Empaquetado:** NPM Registry (`@openfeedback/react`, `@openfeedback/client`).
*   **Build:** tsup (esbuild) — dual ESM/CJS con declaraciones de tipos.
*   **Estilos:** Headless (sin estilos) + Tema opcional basado en Tailwind CSS y Radix UI.
*   **Utilidades:** `clsx` + `tailwind-merge` para composicion de clases.

### 4.2 Backend (Supabase)
*   **Base de Datos:** PostgreSQL via Supabase (con RLS habilitado en todas las tablas).
*   **API de Lectura:** PostgREST (Supabase REST API con `anon key`).
*   **API de Escritura:** Supabase Edge Functions (Deno runtime, `service role`).
*   **Seguridad:** Validacion HMAC-SHA256 en Edge Functions. User IDs hasheados con salt per-project. Comparacion constant-time.
*   **Privacidad:** Pseudonymous Vault — tabla aislada de PII con emails encriptados client-side.

### 4.3 DevOps & CLI
*   **Herramienta:** `@openfeedback/cli` (Node.js, skeleton implementado).
*   **Funcion planificada:** Analisis de historial Git con Fuzzy Matching, generacion de changelog, `openfeedback sync`.

### 4.4 Monorepo
*   **Workspaces:** pnpm 9.x
*   **Orquestacion:** Turborepo con cache incremental
*   **Configs compartidas:** `@openfeedback/typescript-config`, `@openfeedback/tailwind-config`

## 5. Arquitectura de Modulos

### Modulo A: SDK de Autenticacion Transparente (Implementado)

El componente `<OpenFeedbackProvider>` inyecta el contexto de auth y el cliente API.

```tsx
// La firma se computa server-side en un Server Action
const { signature, auth } = await signVoteRequest(userId, suggestionId, "up");

// El Provider recibe el auth context pre-firmado
<OpenFeedbackProvider
  config={{ projectId: "...", apiUrl: "https://..." }}
  anonKey="sb-anon-key"
  authContext={{
    userId: currentUser.id,
    signature,
    timestamp: auth.timestamp,
    nonce: auth.nonce,
  }}
>
  {children}
</OpenFeedbackProvider>
```

### Modulo B: Hooks Headless (Implementado)

Hooks para control total de la UI:

*   `useSuggestions(options?)`: Fetch de lista con filtrado y orden.
*   `useVote()`: Votar/desvotar con firma server-side.
*   `useSubmitSuggestion()`: Crear nuevo feedback con firma server-side.

### Modulo C: Generador de Changelog (Planificado)

Un pipeline que conecta el codigo con el feedback:

1.  Dev hace commit: `feat: allow png export`.
2.  CI detecta coincidencia difusa con Sugerencia #45 "Export to PNG". Bot comenta PR: "Cierra esto #45?". Dev confirma.
3.  CI/CD ejecuta `openfeedback release`.
4.  Sistema marca #45 como "Shipped" y desencripta emails temporalmente para notificar.

### Modulo D: Roadmap as Code (Planificado)

La verdad sobre el roadmap vive en el repositorio, no en una base de datos opaca:

1.  Crea `ROADMAP.md` en tu repo usando formato "Anchor-based": `- [ ] Feature Name <!-- id: 123 -->`.
2.  Ejecuta `npx openfeedback sync` localmente.
3.  TU haces el commit. Cero sorpresas en CI. Control total.

## 6. Estrategia de Mercado (Go-to-Market)

### Vector de Entrada: Nicho Next.js
No competimos contra Canny en general. Competimos por ser la opcion por defecto en el ecosistema Next.js / Vercel.

*   **Tactica:** Crear "Starters" y "Boilerplates" de SaaS que ya incluyan OpenFeedback pre-instalado.

### Diferenciador: Privacidad Honesta (GDPR)
Nada de promesas falsas de "Zero-Knowledge" que rompen funcionalidades. Ofrecemos **Pseudonimato Auditable**: los votos no estan vinculados publicamente a identidades, pero el administrador mantiene la capacidad tecnica (encriptada) de contactar usuarios.

### Modelo de Negocio (Open Core)
*   **Self-Hosted Standard:** Gratis y de codigo abierto.
*   **Enterprise Support:** Contratos de soporte y auditoria para grandes volumenes.

## 7. Roadmap de Desarrollo

### Fase 1: Scaffold (Completada)
*   **Entregable:** Monorepo con pnpm + Turborepo, configs compartidas, skeleton de todos los paquetes.
*   **Estado:** Build funcional de `@openfeedback/client`, `@openfeedback/react`, `@openfeedback/cli`.

### Fase 2: Core Engine (Completada)
*   **Entregable:** Schema PostgreSQL + RLS, Edge Functions (submit-vote, submit-suggestion), API Client, React Hooks.
*   **Auditoria de seguridad:** 9 vulnerabilidades identificadas y corregidas (timing attacks, unsigned vote payload, unsalted hashes, unbounded nonce store, missing CORS, leaked DB errors, missing runtime validation, duplicate types, missing authenticated-role RLS).

### Fase 3: Demo App (Pendiente)
*   **Objetivo:** App Next.js funcional que demuestre el SDK end-to-end.
*   **Entregable:** `apps/demo-app` con Server Actions, Provider, y componentes usando los 3 hooks.

### Fase 4: CLI & Changelog (Pendiente)
*   **Objetivo:** CLI funcional para generacion de changelogs.
*   **Entregable:** `openfeedback-changelog-action` para GitHub Marketplace.

### Fase 5: Ecosistema y Estabilidad (Pendiente)
*   **Objetivo:** Robustez y extensibilidad.
*   **Entregable:** Sistema de Plugins, Webhooks salientes, integracion Slack/Discord.

## 8. Estructura de Repositorio (Actual)

```text
/
├── apps/
│   ├── web-dashboard/          # Panel admin (placeholder)
│   ├── docs/                   # Documentacion (placeholder)
│   └── demo-app/               # App Next.js de ejemplo (placeholder)
│
├── packages/
│   ├── react/                  # SDK React — Provider, Hooks, cn()
│   ├── client/                 # Cliente JS — Schemas, API Client, Signing
│   ├── cli/                    # CLI (skeleton)
│   ├── typescript-config/      # TSConfigs compartidos
│   └── tailwind-config/        # Preset Tailwind compartido
│
├── supabase/
│   ├── migrations/             # Schema SQL + RLS + Triggers
│   └── functions/
│       ├── _shared/            # Auth, Crypto, CORS, Validation
│       ├── submit-vote/        # Edge Function: votar
│       └── submit-suggestion/  # Edge Function: crear sugerencia
│
├── docker/                     # Self-Hosting (placeholder)
└── docs/                       # Documentacion del proyecto
    ├── blueprint.md            # Este archivo (Vision y Arquitectura)
    ├── architecture/
    │   ├── overview.md         # Arquitectura del sistema
    │   ├── database.md         # Schema de base de datos
    │   ├── security.md         # Modelo de seguridad
    │   └── Diagramas/          # SVG Auth Flow
    ├── guides/                 
    │   ├── integration.md      # Guia de integracion del SDK
    │   └── web-dashboard.md    # Manual del panel de administracion
    └── strategy/               
        ├── analisis-estrategico.md # Analisis del nicho de mercado
        └── launch-copy.md      # Textos para lanzamiento

## 9. Documentacion Adicional

| Documento | Contenido |
|---|---|
| [architecture/overview.md](./architecture/overview.md) | Vista general, estructura del monorepo, flujo de datos, responsabilidades de paquetes |
| [architecture/database.md](./architecture/database.md) | Tablas, RLS, triggers, diseño del Pseudonymous Vault |
| [architecture/security.md](./architecture/security.md) | Signed Stateless Auth, HMAC, nonces, timing-safe, invariantes de seguridad |
| [guides/integration.md](./guides/integration.md) | Guia paso a paso para integrar en Next.js con ejemplos de codigo |
| [guides/web-dashboard.md](./guides/web-dashboard.md) | Configuracion y manejo del Admin Dashboard |
| [architecture/Diagramas/](./architecture/Diagramas/) | Diagramas visuales de autenticacion y vault |
