import fs from 'node:fs'
import { createRequire } from 'node:module'
import postcss from 'postcss'
import tailwind from 'tailwindcss'

const localRequire = createRequire(import.meta.url)
const { build } = createRequire(localRequire.resolve('tsx'))('esbuild')

async function main() {
  fs.mkdirSync('.artifacts/buyer-followup', { recursive: true })
  await build({
    entryPoints: {
      app: 'tests/ui/buyer-followup-fixture.tsx',
      header: 'tests/ui/buyer-header-fixture.tsx',
      autosave: 'tests/ui/buyer-autosave-fixture.tsx',
      usage: 'tests/ui/buyer-usage-fixture.tsx',
      searchRequest: 'tests/ui/search-request-fixture.tsx',
    },
    bundle: true,
    outdir: '.artifacts/buyer-followup',
    platform: 'browser',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [
      {
        name: 'next-browser-fixture',
        setup(plugin) {
          plugin.onResolve({ filter: /\/(usage-action|catalog-actions)$/ }, () => ({
            path: 'usage-actions',
            namespace: 'fixture',
          }))
          plugin.onLoad({ filter: /^usage-actions$/, namespace: 'fixture' }, () => ({
            contents:
              'export const saveBuyerUsage = (x) => window.usageFixture.save("usage",x.after); export const saveCatalog = (x) => window.usageFixture.save("catalog",x.after);',
          }))
          plugin.onResolve({ filter: /^\.\/actions$/ }, (args) =>
            args.importer.endsWith('buyer-lead-edit-form.tsx')
              ? { path: 'buyer-actions', namespace: 'fixture' }
              : undefined
          )
          plugin.onResolve({ filter: /^@\/app\/\(backoffice\)\/search-actions$/ }, () => ({
            path: 'fixture-search',
            namespace: 'fixture',
          }))
          plugin.onResolve({ filter: /^\.\/actions$/ }, (args) =>
            args.importer.endsWith('buyer-topbar-actions.tsx')
              ? { path: 'fixture-lost', namespace: 'fixture' }
              : undefined
          )
          plugin.onResolve({ filter: /^next\/(navigation|link)$/ }, ({ path }) => ({
            path,
            namespace: 'fixture',
          }))
          plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({
            contents:
              path === 'fixture-search'
                ? 'export async function globalSearch() { return {compradores:[],vendedores:[],vehiculos:[],captaciones:[]} }'
                : path === 'fixture-lost'
                  ? 'export function markBuyerLeadLost() { throw Error("La prueba de cancelación no debe guardar") }'
                  : path === 'buyer-actions'
                    ? 'export function updateBuyerLead(id, data, fields) { return window.autosaveHarness.save(data, fields) }'
                    : path.endsWith('navigation')
                      ? 'const router = { refresh() {}, replace() {}, push(url) { window.autosaveHarness.destination = url } }; export function useRouter() { return router } export const usePathname = () => location.pathname; export const useParams = () => ({id: location.pathname.split("/")[2]}); export const useSearchParams = () => new URLSearchParams(location.search);'
                      : 'import React from "react"; export default function Link(props) { return React.createElement("a", props) }',
            resolveDir: process.cwd(),
          }))
        },
      },
    ],
  })
  const css = await postcss([tailwind('./tailwind.config.ts')]).process(
    fs.readFileSync('app/globals.css', 'utf8'),
    { from: 'app/globals.css' }
  )
  fs.writeFileSync('.artifacts/buyer-followup/style.css', css.css)
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
