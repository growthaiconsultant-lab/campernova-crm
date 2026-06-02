# ADR 0003 — Autenticación por magic link (sin contraseñas)

**Estado**: Aceptado

## Contexto

El backoffice es para un equipo interno pequeño y de confianza. Hay que evitar la gestión de contraseñas (almacenamiento, reset, fuga) y el auto-registro.

## Decisión

**Supabase Auth con magic link (OTP por email)**. `/login` solo envía el enlace a emails ya presentes en la tabla `User` (sin auto-registro). `/auth/callback` intercambia el code, sincroniza `authId` en el primer login y bloquea usuarios inactivos. `middleware.ts` protege todo salvo `PUBLIC_PATHS`.

## Consecuencias

- Cero contraseñas que gestionar; alta de usuarios vía seed/UI.
- Los tests e2e autenticados no pueden completar el magic link headless → se usa un bypass por `storageState` con la admin API de Supabase (solo en tooling de test, sin tocar producción). Ver ADR 0005 y `e2e/global-setup.ts`.
