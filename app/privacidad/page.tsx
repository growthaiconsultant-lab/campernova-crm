import type { Metadata } from 'next'
import { LegalLayout } from '@/components/legal-layout'

export const metadata: Metadata = {
  title: 'Política de Privacidad — CampersNova',
  description: 'Información sobre el tratamiento de tus datos personales en CampersNova.',
}

// ⚠️  PENDIENTE ANTES DEL DEPLOY: sustituir todos los valores [PENDIENTE_*]

export default function PrivacidadPage() {
  return (
    <LegalLayout title="Política de Privacidad" lastUpdated="Mayo 2026">
      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">
          1. Responsable del tratamiento
        </h2>
        <ul className="list-none space-y-1 text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Identidad:</span>{' '}
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
            <span className="font-medium text-foreground">Dirección:</span>{' '}
            <span className="rounded bg-yellow-100 px-1 text-xs text-yellow-800">
              [PENDIENTE_DOMICILIO]
            </span>
          </li>
          <li>
            <span className="font-medium text-foreground">Email:</span> info@campersnova.com
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">
          2. Datos que recogemos y finalidades
        </h2>
        <div className="space-y-4 text-muted-foreground">
          <div>
            <p className="mb-1 font-medium text-foreground">
              Formulario de venta de vehículo (/vender)
            </p>
            <p>
              Recogemos nombre, email, teléfono y datos del vehículo que nos facilitas. Los usamos
              para gestionar tu solicitud de tasación y el proceso de venta, contactarte para
              confirmar los datos y hacer seguimiento comercial del expediente.
            </p>
            <p className="mt-1">
              <span className="font-medium text-foreground">Base jurídica:</span> ejecución de un
              precontrato (art. 6.1.b RGPD).
            </p>
          </div>
          <div>
            <p className="mb-1 font-medium text-foreground">Formulario de contacto (/contacto)</p>
            <p>Recogemos los datos que nos facilites voluntariamente para responder tu consulta.</p>
            <p className="mt-1">
              <span className="font-medium text-foreground">Base jurídica:</span> interés legítimo
              en atender consultas de usuarios (art. 6.1.f RGPD).
            </p>
          </div>
          <div>
            <p className="mb-1 font-medium text-foreground">Análisis web (PostHog)</p>
            <p>
              Usamos PostHog para recopilar datos de uso agregados y anónimos del sitio web (páginas
              visitadas, tiempo en página, dispositivo). No se recogen datos personales
              identificativos sin consentimiento previo.
            </p>
            <p className="mt-1">
              <span className="font-medium text-foreground">Base jurídica:</span> consentimiento
              (art. 6.1.a RGPD) mediante la aceptación del banner de cookies.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">3. Plazo de conservación</h2>
        <p className="text-muted-foreground">
          Los datos relativos a un expediente de venta se conservan mientras la relación comercial
          esté activa y, una vez concluida, durante el plazo de prescripción legal aplicable
          (generalmente 5 años). Los datos de consultas se eliminan a los 12 meses de la última
          comunicación.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">4. Destinatarios</h2>
        <p className="text-muted-foreground">
          No cedemos tus datos a terceros salvo obligación legal. Trabajamos con los siguientes
          encargados de tratamiento bajo acuerdo de confidencialidad:
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Supabase Inc.</span> — almacenamiento de
            base de datos (servidores en Frankfurt, UE)
          </li>
          <li>
            <span className="font-medium text-foreground">Resend Inc.</span> — envío de emails
            transaccionales
          </li>
          <li>
            <span className="font-medium text-foreground">PostHog Inc.</span> — analítica web
            (instancia EU)
          </li>
          <li>
            <span className="font-medium text-foreground">Vercel Inc.</span> — alojamiento del sitio
            web
          </li>
        </ul>
        <p className="mt-2 text-muted-foreground">
          Todos los proveedores indicados ofrecen garantías adecuadas de protección de datos
          conforme al RGPD (SCCs o marco de adecuación EU-US).
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">5. Tus derechos</h2>
        <p className="text-muted-foreground">
          Puedes ejercer en cualquier momento los siguientes derechos enviando un email a{' '}
          <a href="mailto:info@campersnova.com" className="text-[#294e4c] hover:underline">
            info@campersnova.com
          </a>{' '}
          con asunto &ldquo;Protección de datos&rdquo;:
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Acceso:</span> conocer qué datos tratamos
            sobre ti.
          </li>
          <li>
            <span className="font-medium text-foreground">Rectificación:</span> corregir datos
            inexactos.
          </li>
          <li>
            <span className="font-medium text-foreground">Supresión:</span> solicitar el borrado de
            tus datos.
          </li>
          <li>
            <span className="font-medium text-foreground">Oposición:</span> oponerte al tratamiento
            basado en interés legítimo.
          </li>
          <li>
            <span className="font-medium text-foreground">Portabilidad:</span> recibir tus datos en
            formato estructurado.
          </li>
          <li>
            <span className="font-medium text-foreground">Limitación:</span> solicitar la
            restricción del tratamiento.
          </li>
        </ul>
        <p className="mt-2 text-muted-foreground">
          Si consideras que el tratamiento no es conforme a la normativa, puedes reclamar ante la
          Agencia Española de Protección de Datos (aepd.es).
        </p>
      </section>
    </LegalLayout>
  )
}
