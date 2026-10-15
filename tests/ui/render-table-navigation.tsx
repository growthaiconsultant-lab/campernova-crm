import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import { ActionableTable } from '../../components/redesign/actionable-table'

const rows = [1, 2, 3].map((id) => ({ id: `test-${id}`, name: `Comprador ficticio ${id}` }))
type Row = (typeof rows)[number]
const href = (row: Row) => `/compradores/${row.id}`

async function render() {
  mkdirSync('.artifacts/table-navigation', { recursive: true })
  const css = await postcss([tailwindcss('./tailwind.config.ts')]).process(
    readFileSync('app/globals.css', 'utf8'),
    { from: 'app/globals.css' }
  )
  writeFileSync('.artifacts/table-navigation/style.css', css.css)
  for (const reverse of [false, true])
    for (const mobileActions of [false, true])
      for (const linked of [false, true]) {
        const columns = [
          {
            key: 'buyer',
            header: 'Comprador',
            cell: (row: Row) => (
              <div>
                {row.name}
                <div>Camper</div>
              </div>
            ),
          },
          { key: 'budget', header: 'Presupuesto', cell: () => <span>50.000 €</span> },
          {
            key: 'status',
            header: 'Estado',
            rowLink: false,
            cell: (row: Row) => (
              <select aria-label={`Estado ${row.id}`} defaultValue="new">
                <option value="new">Nuevo</option>
                <option value="contacted">Contactado</option>
              </select>
            ),
          },
          {
            key: '__cta',
            header: 'Acciones',
            cell: (row: Row) => <a href={`/otra-ruta/${row.id}`}>Otra acción</a>,
          },
        ]
        const markup = renderToStaticMarkup(
          <main className="crm-theme">
            <button type="button">Fuera de la tabla</button>
            <ActionableTable
              rows={reverse ? [...rows].reverse() : rows}
              rowKey={(row) => row.id}
              rowHref={linked ? href : undefined}
              columns={columns}
              mobileCard={(row) => <div>{row.name}</div>}
              mobileCardActions={
                mobileActions ? (row) => <button type="button">Editar {row.id}</button> : undefined
              }
            />
          </main>
        )
        writeFileSync(
          `.artifacts/table-navigation/${reverse}-${mobileActions}-${linked}.html`,
          markup
        )
      }
}
void render().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
