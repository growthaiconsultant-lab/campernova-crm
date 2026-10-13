# Integración del servidor de Meta Lead Ads con Compradores

Campaña: CN · Encuentra tu camper · oct 2026. Página 1321098031095901;
formulario 3364123057107449. El equipo emisor escucha Meta y reenvía cada contacto.

## Petición

POST `https://campersnova.com/api/landing/encuentra-tu-camper`

```http
Content-Type: application/json
Authorization: Bearer <clave facilitada por canal privado>
```

No enviar Origin ni usar el navegador. Clave exclusiva de esta integración, sólo en el servidor.
El receptor configura `META_BUYER_INTAKE_KEY` en Vercel Production como variable sensible;
mínimo 32 bytes aleatorios. Preview utiliza otra clave. No incluir claves en código, URL o logs.

El JSON es el mismo de la landing. Ejemplo ficticio de contrato (no enviarlo a producción):

```json
{
  "nombre": "Contacto de ejemplo",
  "contacto": "600000000",
  "gdpr_consent": true,
  "web_url": "",
  "respuestas": {
    "event_id": "meta_ID_DEL_LEAD",
    "tipo": "Camper / furgoneta camperizada",
    "plazas": "1 o 2",
    "presupuesto": "50.000–65.000 €",
    "cuando": "En 1 a 3 meses",
    "nombre": "Contacto de ejemplo",
    "telefono": "600000000",
    "origen": "utm_source=facebook · utm_medium=lead_ads",
    "atribucion": {
      "utm_source": "facebook",
      "utm_medium": "lead_ads",
      "utm_campaign": "CN · Encuentra tu camper · oct 2026"
    },
    "pagina": "/encuentra-tu-camper.html"
  }
}
```

`utm_source=facebook` y `utm_medium=lead_ads` son obligatorios en `respuestas.atribucion`.
Pueden añadirse `campaign_id`, `adset_id`, `ad_id`, `utm_content`, `utm_id`, `utm_term`, `placement`.
No añadir campos desconocidos: contrato estricto. IDs de página/formulario son contexto de la
configuración del emisor, no claves admitidas en este JSON. No inferir respuestas ausentes ni marcar
consentimiento si el formulario no lo obtuvo realmente. `nombre`/`telefono` internos coinciden
con `nombre`/`contacto` externos. Contacto 9–15 dígitos; cuerpo máximo 16 KiB.

## Valores del formulario

| Campo                   | Valores admitidos                                                    |
| ----------------------- | -------------------------------------------------------------------- |
| tipo                    | Camper / furgoneta camperizada; Autocaravana; Aún no lo sé           |
| plazas                  | 1 o 2; 3 o 4; 5 o más                                                |
| presupuesto             | Menos de 50.000 €; 50.000–65.000 €; 65.000–80.000 €; Más de 80.000 € |
| cuando                  | Lo antes posible; En 1 a 3 meses; Más adelante                       |
| financiacion (opcional) | Sí; No; Quiero que me lo expliquéis                                  |
| entrega (opcional)      | Sí, quiero entregarla a cuenta; No                                   |
| zona (opcional)         | Población, máximo 160 caracteres                                     |
| detalle (opcional)      | Texto de búsqueda, máximo 2000 caracteres                            |

## Confirmación y reintentos

200 `{"ok":true}` confirma almacenamiento. Si ya se recibió el mismo payload parseado, confirma
sin duplicar comprador, nota ni KPI. Usar `event_id` estable derivado del ID de lead Meta,
letras/números/guion/guion bajo, máximo 100 caracteres. Conservar exactamente las mismas respuestas
y atribución durante todos los reintentos; una petición modificada tiene identidad distinta.

Reintentar 429, 503 y timeout con espera exponencial y payload congelado. Cuota exclusiva: 300
nuevos contactos por hora; confirmados no consumen cuota. Mantener cola hasta recibir ok:true.
400 requiere corregir contrato; 401 clave incorrecta/deshabilitada; 403 indica ausencia de
Authorization y falta de Origin web; 413 tamaño; 415 Content-Type. No falsificar Origin para
sortear la autenticación. Sin CORS, sin consulta de leads ni IDs expuestos por esta API.

## Dónde aparecen y activación

CRM → [Compradores de Meta](https://crm.campersnova.com/compradores?source=META).
Origen Meta / Facebook, estado Nuevo y bloque Origen de la campaña con
facebook/lead_ads y campaña/anuncio disponibles. La IP del servidor no se atribuye al interesado.

Tras deployment y smoke negativo del receptor, el emisor instala la clave, activa reenvío del
formulario concreto y confirma una entrega real. Los contactos anteriores no se importan solos:
si el emisor los conserva, puede reenviarlos con sus event_id originales y consentimiento real.
El relay no modifica los avisos actuales a info@campersnova.com.

Revocación: quitar o rotar META_BUYER_INTAKE_KEY y redeploy; actualizar emisor al rotar.
Los formularios web siguen operativos sin Authorization.
