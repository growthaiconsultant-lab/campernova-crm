# Cuentas e identidades

> ⚠️ El propietario gestiona **varios proyectos con cuentas distintas**. Confundirlas
> provoca fallos de `git push`, conectores (MCP) apuntando a la cuenta equivocada y
> tiempo perdido. Esta es la referencia para no equivocarse. **No contiene secretos.**

## Identidad CORRECTA para este proyecto (Campernova)

| Servicio | Cuenta / identidad correcta |
| -------- | --------------------------- |
| **GitHub** | org `growthaiconsultant-lab` · usuario `growthaiconsultant-8035` (`growth.ai.consultant@gmail.com`) · repo `growthaiconsultant-lab/campernova-crm` |
| **Supabase** | org "growthaiconsultant-lab's Org" · proyecto prod `bbmglaatlyilxutzomxd` (Frankfurt, eu-central-1) |
| **Vercel** | proyecto `campernova-crm` → `campernova-crm.vercel.app` |
| **Navegador** | extensión Chrome **"AI MARKETING SOLUTIONS"** (tiene las sesiones de Vercel/Resend/Sentry/Supabase de Campernova) |

## Otra identidad — NO usar para Campernova

- **`joeylito`** (`joel.martinez@tutete.com`) → proyecto **TuteBot** (distinto).
- Supabase "joeylito's Org" (proyectos "joeylito's Project", "tutebot-staging").
- A veces `localhost:3000` sirve **TuteBot**, no Campernova — no asumir.

## Gotchas conocidos y cómo resolverlos

1. **`git push` denegado a `joeylito`** → el remote usa _namespacing_ por usuario:
   `https://growthaiconsultant-8035@github.com/growthaiconsultant-lab/campernova-crm.git`
   (ya configurado; comprobar con `git remote -v`). Así cada cuenta guarda su credencial aparte y no se pisan.
2. **`gh` CLI tiene 2 cuentas** → para PRs / branch protection / admin:
   `gh auth switch --user growthaiconsultant-lab` (la activa por defecto puede ser `joeylito`, sin acceso).
3. **Supabase**: hay dos conexiones MCP. La **de proyecto** apunta a Campernova prod (correcto, para SQL/inspección). La **de cuenta** (crear proyectos) está en la cuenta de `joeylito` (incorrecto) → para crear el proyecto de **staging** de Campernova hay que usar el dashboard en el navegador "AI MARKETING SOLUTIONS".
4. **Dashboards (Vercel/Resend/Sentry/Supabase) de Campernova** → usar el navegador **"AI MARKETING SOLUTIONS"**, no otro.

> Detalle operativo y de credenciales completas: `CLAUDE.md` § "Servicios externos" y `.env.local` (no versionado).
