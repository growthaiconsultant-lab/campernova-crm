import type { Metadata } from 'next'
import { LegalLayout } from '@/components/legal-layout'

export const metadata: Metadata = {
  title: 'Aviso Legal — CampersNova',
  description: 'Aviso legal e información sobre el titular del sitio web campersnova.com.',
}

// ⚠️  PENDIENTE ANTES DEL DEPLOY: sustituir todos los valores [PENDIENTE_*]
// con los datos reales del operador (autónomo / S.L.)

export default function AvisoLegalPage() {
  return (
    <LegalLayout title="Aviso Legal" lastUpdated="Mayo 2026">
      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">
          1. Datos identificativos del titular
        </h2>
        <p className="text-muted-foreground">
          En cumplimiento de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la
          Información y de Comercio Electrónico (LSSI-CE), se facilitan los siguientes datos:
        </p>
        <ul className="mt-3 list-none space-y-1 text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Denominación social:</span>{' '}
            <span className="rounded bg-yellow-100 px-1 text-xs text-yellow-800">
              [PENDIENTE_NOMBRE_LEGAL]
            </span>
          </li>
          <li>
            <span className="font-medium text-foreground">NIF / CIF:</span>{' '}
            <span className="rounded bg-yellow-100 px-1 text-xs text-yellow-800">
              [PENDIENTE_NIF]
            </span>
          </li>
          <li>
            <span className="font-medium text-foreground">Domicilio:</span>{' '}
            <span className="rounded bg-yellow-100 px-1 text-xs text-yellow-800">
              [PENDIENTE_DOMICILIO]
            </span>
          </li>
          <li>
            <span className="font-medium text-foreground">Email de contacto:</span>{' '}
            info@campersnova.com
          </li>
          <li>
            <span className="font-medium text-foreground">Sitio web:</span> campersnova.com
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">2. Objeto y actividad</h2>
        <p className="text-muted-foreground">
          CampersNova es un servicio de intermediación para la compraventa de autocaravanas y
          campers semi-nuevas en España. El titular actúa como agente intermediario entre vendedores
          y compradores, percibiendo una comisión sobre el precio de venta acordado. El titular no
          es propietario de los vehículos anunciados ni parte en los contratos de compraventa que se
          formalicen entre vendedor y comprador.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">3. Condiciones de uso</h2>
        <p className="text-muted-foreground">
          El acceso y uso de este sitio web implica la aceptación de las presentes condiciones. El
          usuario se compromete a hacer un uso adecuado de los contenidos y servicios, y a no
          emplearlos para actividades ilícitas o contrarias a la buena fe y al orden público.
        </p>
        <p className="mt-2 text-muted-foreground">
          El titular se reserva el derecho a modificar en cualquier momento los contenidos del sitio
          web, así como las presentes condiciones de uso. Los cambios entrarán en vigor desde su
          publicación en el sitio.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">
          4. Propiedad intelectual e industrial
        </h2>
        <p className="text-muted-foreground">
          Todos los contenidos del sitio web —incluyendo textos, imágenes, logotipos, diseño gráfico
          y código fuente— son propiedad del titular o dispone de licencia para su uso. Queda
          prohibida su reproducción, distribución o modificación sin autorización expresa y por
          escrito del titular.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">
          5. Exclusión de garantías y responsabilidad
        </h2>
        <p className="text-muted-foreground">
          El titular no garantiza la disponibilidad continua del sitio ni la ausencia de errores en
          sus contenidos. Las tasaciones publicadas son orientativas y no vinculantes. El titular no
          se responsabiliza de los daños derivados del uso o la imposibilidad de uso del sitio, ni
          de los errores u omisiones en la información facilitada por terceros.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">
          6. Legislación aplicable y jurisdicción
        </h2>
        <p className="text-muted-foreground">
          Las presentes condiciones se rigen por la legislación española. Para la resolución de
          cualquier controversia, las partes se someten, con renuncia expresa a cualquier otro
          fuero, a los Juzgados y Tribunales del domicilio del titular.
        </p>
      </section>
    </LegalLayout>
  )
}
