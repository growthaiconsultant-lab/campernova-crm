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
      stock: 'tests/ui/buyer-stock-fixture.tsx',
      offers: 'tests/ui/buyer-offers-fixture.tsx',
      vehicleInventory: 'tests/ui/vehicle-inventory-fixture.tsx',
      inventoryOperations: 'tests/ui/inventory-operations-fixture.tsx',
      sellerSale: 'tests/ui/seller-sale-fixture.tsx',
      checklist: 'tests/ui/seller-checklist-fixture.tsx',
      sellerPreparation: 'tests/ui/seller-preparation-fixture.tsx',
      sellerFollowup: 'tests/ui/seller-followup-fixture.tsx',
      postventa: 'tests/ui/buyer-postventa-fixture.tsx',
      documents: 'tests/ui/buyer-documents-fixture.tsx',
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
          plugin.onResolve({ filter: /^\.\/(actions|rv-suggest-actions)$/ }, (args) =>
            args.importer.endsWith('vehicle-edit-form.tsx')
              ? { path: args.path, namespace: 'checklist' }
              : undefined
          )
          plugin.onLoad({ filter: /.*/, namespace: 'checklist' }, ({ path }) => ({
            contents: path.endsWith('/actions')
              ? 'export const updateVehicle=(...args)=>window.checklist.save(...args)'
              : 'export const suggestVehicleRvTaxonomy=()=>({error:"Sin sugerencias"})',
          }))
          plugin.onResolve(
            { filter: /^@\/app\/\(backoffice\)\/operaciones\/(documentos\/)?actions$/ },
            ({ path }) => ({ path, namespace: 'document-stub' })
          )
          plugin.onLoad({ filter: /.*/, namespace: 'document-stub' }, ({ path }) => ({
            contents: path.endsWith('/documentos/actions')
              ? 'export const listOperationalDocuments=(...args)=>window.docsFixture.list(...args); export const openOperationalDocument=(...args)=>window.docsFixture.open(...args); export const uploadOperationalDocument=(...args)=>window.docsFixture.upload(...args);'
              : 'export const searchOperationalTargets=async()=>({ok:true,items:[]})',
          }))
          plugin.onResolve(
            {
              filter:
                /^@\/app\/\(backoffice\)\/vendedores\/(\[id\]\/(actions|legal-actions)|photo-actions)$/,
            },
            ({ path }) => ({ path, namespace: 'seller-preparation-stub' })
          )
          plugin.onLoad({ filter: /.*/, namespace: 'seller-preparation-stub' }, ({ path }) => ({
            contents: path.endsWith('/legal-actions')
              ? 'export const uploadVehicleDocument=(id,body)=>window.preparationFixture.document(id,body); export const deleteVehicleDocument=()=>{}; export const getVehicleDocumentSignedUrl=()=>({ok:false});'
              : path.endsWith('/photo-actions')
                ? 'export const uploadVehiclePhoto=body=>window.preparationFixture.photo(body); export const listVehiclePhotos=()=>window.preparationFixture.list(); export const deleteVehiclePhoto=id=>window.preparationFixture.remove(id); export const reorderVehiclePhotos=(id,order)=>window.preparationFixture.reorder(order); export const setVehiclePhotoCategory=()=>{};'
                : 'export const publishVehicle=()=>({ok:true}); export const forcePublishVehicle=()=>({ok:true})',
          }))
          plugin.onResolve({ filter: /^next\/image$/ }, () => ({
            path: 'next-image',
            namespace: 'fixture-image',
          }))
          plugin.onLoad({ filter: /.*/, namespace: 'fixture-image' }, () => ({
            contents:
              'import React from "react"; export default function Image({src,alt}) { return React.createElement("img",{src,alt}) }',
            resolveDir: process.cwd(),
          }))
          plugin.onResolve(
            { filter: /^@\/app\/\(backoffice\)\/vendedores\/\[id\]\/portal-actions$/ },
            () => ({ path: 'listing', namespace: 'portal-fixture' })
          )
          plugin.onLoad({ filter: /.*/, namespace: 'portal-fixture' }, () => ({
            contents:
              'export const savePortalListing=(...args)=>window.portalFixture.save(...args)',
          }))
          plugin.onResolve({ filter: /vendedores\/\[id\]\/ads-actions$/ }, () => ({
            path: 'ad-text',
            namespace: 'ad-text-fixture',
          }))
          plugin.onLoad({ filter: /.*/, namespace: 'ad-text-fixture' }, () => ({
            contents:
              'export const generateVehicleAd=()=>{throw Error("Generación inesperada")};export const saveVehicleAdText=(input)=>window.portalFixture.saveText(input);',
          }))
          plugin.onResolve({ filter: /^(\.\.\/ofertas\/actions|\.\/discard-action)$/ }, (args) =>
            args.importer.endsWith('inventory-sale-actions.tsx')
              ? { path: args.path, namespace: 'inventory-operations' }
              : undefined
          )
          plugin.onLoad({ filter: /.*/, namespace: 'inventory-operations' }, ({ path }) => ({
            contents: path.endsWith('discard-action')
              ? 'export const discardInventoryVehicle=(...args)=>window.operations.discard(...args)'
              : 'export const updateOfferStatus=(...args)=>window.operations.reserve(...args)',
          }))
          const stockStubs = {
            '@/app/(backoffice)/ofertas/actions':
              'export const createOffer = (...args) => window.offerFixture.create(...args); export const updateOfferStatus = (...args) => window.offerFixture.update(...args)',
            '@/lib/db': 'export const db = {}',
            '@/lib/matching/prisma-deps':
              'export const prismaMatchingDeps = () => window.stockFixture',
            '@/app/(backoffice)/matches/manual-actions':
              'export const createManualMatch = x => window.stockFixture.save(x); export const searchManualMatches = () => ({ok:true,items:[],hasMore:false})',
            '@/app/(backoffice)/matches/actions': 'export const updateMatchStatus = () => ({})',
          }
          plugin.onResolve(
            {
              filter:
                /^@\/(lib\/(db|matching\/prisma-deps)|app\/\(backoffice\)\/(matches\/(manual-actions|actions)|ofertas\/actions))$/,
            },
            ({ path }) => ({ path, namespace: 'stock-stub' })
          )
          plugin.onLoad({ filter: /.*/, namespace: 'stock-stub' }, ({ path }) => ({
            contents: stockStubs[path],
          }))
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
                      ? 'const router = { refresh() {}, replace() {}, push(url) { if (window.inventoryNavigate) window.inventoryNavigate(url); else window.autosaveHarness.destination = url } }; export function useRouter() { return router } export const usePathname = () => location.pathname; export const useParams = () => ({id: location.pathname.split("/")[2]}); export const useSearchParams = () => new URLSearchParams(location.search);'
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
