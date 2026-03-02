# Autorización via Proxy (DX Improvement)

> Documentación sobre el modelo actual de integración "Plug & Play" mediante Route Handlers en Next.js.

## Evolución de la Integración (DX)

Originalmente, OpenFeedback obligaba al desarrollador a crear Server Actions personalizadas que importaban funciones criptográficas (`signRequestBody`, `generateNonce`) de `@openfeedback/client/server`. Esto requería un conocimiento profundo del modelo "Signed Stateless Auth" y exponía una superficie de error propensa a vulnerabilidades (como el Oracle Attack, donde un endpoint genérico mal configurado permitía a un usuario falsificar votos).

Para resolver esto y cumplir con la regla de oro de **menos de 10 líneas de código para la integración**, introdujimos el patrón de **Proxy Route Handler** (`@openfeedback/client/next`).

## ¿Cómo funciona el Proxy?

En lugar de delegar las operaciones criptográficas al código del host app manual, el SDK exporta un manipulador de rutas completo para Next.js (App Router).

### El flujo actual es el siguiente:

1. **El Componente React pide una acción**
   Hooks como `useVote` ya no generan requerimientos criptográficos. Simplemente hacen un `POST` en crudo internamente (e.g. hacia `/api/openfeedback`) con la acción (`vote`) y el payload.
   
2. **El Proxy Intercepta**
   El Route Handler construido con `OpenFeedbackProxy` recibe la petición en el backend del cliente.
   
3. **Resolución de Identidad (Zero Trust Client)**
   El Proxy invoca la función `getUser()` definida por el desarrollador para leer las cookies HTTP/sesión reales (ej. la sesión de NextAuth) y extraer de forma segura el `user_id`. Nunca confía en un `user_id` enviado por el navegador para propósitos de autoría.
   
4. **Firma y Reenvío**
   Si el usuario está autenticado, el Proxy genera un `nonce` y `timestamp` localmente, crea el objeto `auth` combinándolo con el `user_id`, aplica la firma usando `OPENFEEDBACK_HMAC_SECRET`, y retransmite (proxy) la solicitud final hacia el Edge Function de Supabase (`submit-vote` o `submit-suggestion`).

## Ventajas de Arquitectura

- **Mitigación de Oracle Attack:** Es imposible que el cliente frontend falsifique la identidad, ya que el payload enviado a Supabase contiene un `user_id` inyectado 100% en el servidor mediante sesiones seguras del host.
- **Zero Crypto:** Los desarrolladores no ven hashes, firmas o nonces. Solo proveen su secreto como variable de entorno al inicializar el handler.
- **Transparencia:** Para el navegador, parece que simplemente está interactuando con una API REST normal `/api/openfeedback`. Todo el "Stateless Signed Auth" que va hacia el OpenFeedback Engine de fondo es invisible.
