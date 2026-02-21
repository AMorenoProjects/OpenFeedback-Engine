# Modelo de Seguridad

> Documentación del sistema de autenticación, protección de datos y las invariantes de seguridad que deben respetarse en todo el código futuro.

---

## 1. Signed Stateless Auth

OpenFeedback no usa sesiones, tokens JWT propios ni cookies. En su lugar, la app host firma cada petición de escritura con HMAC-SHA256 usando un secreto compartido.

### Flujo completo

```
┌─────────────────────────────────────────────────────────┐
│                     HOST APP (Server)                    │
│                                                         │
│  1. Construye el body completo:                         │
│     body = JSON.stringify({                             │
│       auth: { user_id, nonce, timestamp, project_id },  │
│       vote: { suggestion_id, direction }                │
│     })                                                  │
│                                                         │
│  2. Firma el body completo:                             │
│     signature = HMAC-SHA256(body, hmac_secret)          │
│                                                         │
│  3. Envía signature + auth context al browser           │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                     BROWSER (SDK)                        │
│                                                         │
│  4. Envía POST a Edge Function con:                     │
│     Header: x-openfeedback-signature = <signature>      │
│     Body: <el mismo JSON que fue firmado>               │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  EDGE FUNCTION (Deno)                    │
│                                                         │
│  5. Lee rawBody como string (NO re-serializa)           │
│  6. Valida estructura del body (runtime checks)         │
│  7. Verifica timestamp ±5 minutos                       │
│  8. Busca project.hmac_secret en DB                     │
│  9. expected = HMAC-SHA256(rawBody, secret)             │
│ 10. timingSafeEqual(received, expected)                 │
│ 11. Verifica nonce no fue usado (replay protection)     │
│ 12. user_hash = HMAC(user_id, secret) ← salted         │
│ 13. Ejecuta operación en DB con service role            │
└─────────────────────────────────────────────────────────┘
```

### Por qué este diseño

| Decisión | Alternativa rechazada | Razón |
|---|---|---|
| HMAC por request | JWT con expiración | No requiere token exchange ni refresh. Cada request es auto-contenida |
| Firma del body completo | Firma solo del auth | Previene que un atacante cambie el target del voto sin invalidar la firma |
| Raw body signing | Re-serialización | `JSON.stringify` no garantiza orden de claves entre implementaciones |
| `hmac_secret` en servidor | Secret en browser | El browser nunca toca el secreto. La firma se computa server-side |

---

## 2. Protección contra Replay Attacks

Cada request incluye un `nonce` (valor aleatorio de un solo uso) y un `timestamp`.

### Nonce

- Generado con `crypto.randomBytes(16)` (128 bits de entropía)
- Verificado contra la tabla **`used_nonces`** en PostgreSQL
- El nonce se marca como usado (via `INSERT`) **solo después** de verificar la firma HMAC (evita que un atacante "envenene" la base de datos con requests inválidos)
- El PK compuesto `(project_id, nonce)` garantiza que fallará el Request (`23505 Unique Violation`) indicando un replay attack seguro incluso con Edge Functions distribuidas.

### Timestamp

- Ventana de tolerancia: **5 minutos** (`TIMESTAMP_TOLERANCE_MS`)
- Se calcula como `|server_time - client_timestamp| <= 5min`
- Previene replay de requests capturados hace más de 5 minutos

### Limitaciones conocidas (MVP)

- Las limpiezas de la tabla `used_nonces` no ocurren periódicamente aún mediante Cron Tasks en DB, lo que a futuro podría incidir en tamaño de disco. Resulta en necesidad de un trigger de borrado eventual para timestamps viejos.

---

## 3. Comparación Timing-Safe

La comparación de firmas HMAC usa `timingSafeEqual()`:

```typescript
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
```

**Por qué:** Una comparación normal (`===`) cortocircuita en el primer carácter diferente. Un atacante puede medir el tiempo de respuesta para adivinar la firma correcta byte a byte. XOR sobre todos los caracteres toma el mismo tiempo independientemente de dónde esté la diferencia.

---

## 4. User Hash Salteado

El `user_id` de la app host nunca se almacena directamente en la base de datos.

```
user_hash = HMAC-SHA256(user_id, project_hmac_secret)
```

| Propiedad | Detalle |
|---|---|
| **Algoritmo** | HMAC-SHA256 (no plain SHA-256) |
| **Salt** | El `hmac_secret` del proyecto |
| **Per-project** | El mismo `user_id` produce hashes diferentes en proyectos distintos |
| **Irreversible** | No se puede recuperar `user_id` desde `user_hash` sin el secret |

**Por qué no plain SHA-256:** Sin salt, el mismo usuario tendría el mismo hash en todos los proyectos que usen OpenFeedback. Esto permitiría correlación cross-project (identificar que el usuario X votó en el proyecto A y en el proyecto B). Con HMAC salteado, cada proyecto produce un hash único.

---

## 5. Pseudonymous Vault (GDPR)

Ver diagrama: `docs/Diagramas/Diagrama_Pseudonymous Vault.png`

### Diseño

```
votes (PÚBLICO)                pseudonymous_vault (PRIVADO)
┌────────────────────┐        ┌──────────────────────────┐
│ suggestion_id      │        │ user_hash                │
│ user_hash ─────────┼────────│ encrypted_email          │
│ project_id         │        │ project_id               │
└────────────────────┘        └──────────────────────────┘
  Lectura: anon, auth           Lectura: solo service_role
  Escritura: solo service_role  Escritura: solo service_role
```

### Principios

1. **Separación de tablas:** Los votos son públicos y no contienen PII. El email está en una tabla aislada que ni `anon` ni `authenticated` pueden leer.

2. **Encriptación client-side:** El email se encripta en el browser de la app host antes de enviarse. Ni siquiera OpenFeedback ve el email en texto plano — solo el host app puede desencriptarlo.

3. **GDPR erasure:** Cumplir con una solicitud de borrado es un solo `TRUNCATE pseudonymous_vault` o `DELETE WHERE user_hash = X`. Los votos permanecen como registros anónimos.

4. **Acceso just-in-time:** El vault solo se consulta cuando hay que notificar (ej: "Tu feature request fue shipped"). El host app desencripta el email temporalmente para enviar la notificación.

---

## 6. RLS (Row Level Security)

Todas las tablas tienen RLS habilitado con políticas explícitas para `anon` Y `authenticated`:

| Tabla | `anon` | `authenticated` | `service_role` |
|---|---|---|---|
| `projects` | Denegado total | Denegado total | Full access |
| `suggestions` | Solo lectura | Solo lectura | Full access |
| `votes` | Solo lectura | Solo lectura | Full access |
| `pseudonymous_vault` | Denegado total | Denegado total | Full access |

**Principio:** Los roles `anon`/`authenticated` nunca pueden escribir directamente. Toda escritura pasa por Edge Functions con `service_role`.

---

## 7. Invariantes de Seguridad

Estas reglas no deben violarse en ningún código futuro:

| # | Regla | Referencia |
|---|---|---|
| 1 | **HMAC cubre el body completo** (auth + action), no solo auth | `_shared/auth.ts` |
| 2 | **Firmar el raw body string**, nunca re-serializar con `JSON.stringify` | `_shared/auth.ts` |
| 3 | **Comparación constant-time** para firmas (`timingSafeEqual`) | `_shared/crypto.ts` |
| 4 | **User hash salteado** con `HMAC(user_id, project_secret)` | `_shared/crypto.ts` |
| 5 | **Sanitizar errores**: nunca exponer `supabaseError.message` al cliente | Edge Functions |
| 6 | **Nonce storage asíncrono** en DB (cross-instance safe) | `_shared/nonce.ts` |
| 7 | **`hmac_secret` nunca llega al browser** | `@openfeedback/client/server` es Node-only |
| 8 | **Validación runtime** de todo request body (no solo `as` de TypeScript) | `_shared/validation.ts` |
| 9 | **Nonce se marca después** de verificar firma (evita envenenamiento) | `_shared/auth.ts` |

---

## 8. Sanitización de Errores

Las Edge Functions **nunca** devuelven mensajes de error internos de PostgreSQL al cliente.

```typescript
// MAL (filtra internos de DB)
return errorResponse(`Vote failed: ${insertError.message}`, 500);

// BIEN (log interno + mensaje genérico)
console.error("Vote insert failed:", insertError.message);
return errorResponse("Vote failed", 500);
```

Esto previene que un atacante obtenga nombres de tablas, columnas, constraints o detalles del engine PostgreSQL a través de mensajes de error.

---

## 9. CORS

Las Edge Functions incluyen headers CORS en todas las respuestas:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, x-openfeedback-signature, Authorization
Access-Control-Max-Age: 86400
```

Las peticiones `OPTIONS` (preflight) reciben una respuesta `204 No Content` con estos headers.

> **Nota:** `Allow-Origin: *` es apropiado porque la autenticación se basa en firmas HMAC por request, no en cookies. No hay beneficio de seguridad en restringir el origin cuando el secreto nunca está en el browser.
