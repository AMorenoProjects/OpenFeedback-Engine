# OpenFeedback Engine

> **La Infraestructura de Feedback "Headless" para el Ecosistema Moderno de Next.js.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-green)](https://supabase.com/)

[🇺🇸 Read in English](./README.md)

---

## 🚀 Resumen

**OpenFeedback Engine** no es otro portal de feedback. Es una infraestructura de código abierto diseñada para desarrolladores que desean integrar la recolección de feedback, votaciones y roadmaps directamente en sus aplicaciones SaaS, sin sacrificar su identidad visual ni obligar a los usuarios a crear cuentas externas.

A diferencia de las soluciones monolíticas (Canny, Jira PD), OpenFeedback funciona como un conjunto de primitivas (SDKs y APIs) que se integran en tu ciclo de vida de desarrollo, automatizando la comunicación con el usuario y garantizando la soberanía de los datos.

## ✨ Características Clave

-   **Diseño Headless**: Control total de la UI. Usa nuestros hooks sin estilos o el tema por defecto opcional.
-   **Autenticación Firmada sin Estado**: Autenticación criptográfica sin almacenamiento de sesión. Tus usuarios nunca necesitan un segundo inicio de sesión.
-   **Bóveda Seudónima (Vault)**: Privacidad GDPR-first. Los votos son públicos pero anónimos; los correos electrónicos se cifran y almacenan en una bóveda aislada.
-   **Experiencia de Desarrollador**: Construido para Next.js App Router y Server Actions.
-   **Self-Hosted**: Tú eres dueño de los datos. Funciona sobre tu propia instancia de Supabase.

## 🏗️ Arquitectura

Este proyecto es un monorepo gestionado con `pnpm` y `turborepo`.

### Paquetes (`packages/*`)

-   **`@openfeedback/client`**: Lógica central, cliente API, esquemas Zod y utilidades de firma criptográfica.
-   **`@openfeedback/react`**: SDK de React que contiene el `<OpenFeedbackProvider>`, hooks (`useVote`, `useSuggestions`) y componentes.
-   **`@openfeedback/cli`**: Herramienta CLI para sincronizar roadmaps y generar changelogs.

### Aplicaciones (`apps/*`)

-   **`apps/demo-app`**: Implementación de referencia en Next.js que demuestra el SDK en acción.
-   **`apps/web-dashboard`**: Panel administrativo para gestión de proyectos y moderación.
-   **`apps/docs`**: Sitio de documentación.

### Backend (`supabase/*`)

-   **Base de Datos**: Esquema PostgreSQL con Row Level Security (RLS) habilitado en todas las tablas.
-   **Edge Functions**: Funciones serverless basadas en Deno para operaciones de escritura seguras (`submit-vote`, `submit-suggestion`).

## 🛠️ Comenzando

### Prerrequisitos

-   Node.js >= 20
-   pnpm >= 9
-   Docker (para desarrollo local con Supabase)

### Instalación

1.  **Clonar el repositorio:**
    ```bash
    git clone https://github.com/tu-usuario/openfeedback-engine.git
    cd openfeedback-engine
    ```

2.  **Instalar dependencias:**
    ```bash
    pnpm install
    ```

3.  **Iniciar el entorno de desarrollo:**
    ```bash
    pnpm dev
    ```

### Ejecutar la Demo

Para verificar la instalación y ver el motor en acción:

```bash
pnpm dev --filter demo-app
```

Visita `http://localhost:3000` para interactuar con el tablero de feedback.

## 🔒 Seguridad y Privacidad

OpenFeedback emplea un mecanismo de **Autenticación Firmada sin Estado**. Las solicitudes se firman en el lado del servidor utilizando una firma HMAC-SHA256, asegurando que los votos sean auténticos sin requerir una base de datos de sesión dedicada para el motor de feedback.

Los correos electrónicos de los usuarios se almacenan en una **Bóveda Seudónima**, aislada de los datos públicos de votación y cifrada en reposo, garantizando el cumplimiento de regulaciones de privacidad estrictas como el GDPR.

## 📄 Licencia

Este proyecto está licenciado bajo la [Licencia MIT](LICENSE).

---

Actualmente en desarrollo activo (Fase 2 - Core Engine Completado).
