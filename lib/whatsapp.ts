import { normalizePhone } from './phone'

export function formatPhoneForWhatsApp(phone: string): string {
  return normalizePhone(phone)
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const formatted = formatPhoneForWhatsApp(phone)
  return `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`
}

// CAP-1: el nombre puede faltar; el saludo se compone sin nombre en ese caso (nunca "Hola null,").
function greeting(name: string | null | undefined): string {
  const t = name?.trim()
  return t ? `Hola ${t}` : 'Hola'
}

export function sellerWhatsAppMessage(
  name: string | null | undefined,
  vehicle?: { type: string | null; brand: string | null; model: string | null } | null
): string {
  if (vehicle) {
    const tipo = vehicle.type === 'CAMPER' ? 'camper' : 'autocaravana'
    const veh = [vehicle.brand, vehicle.model].filter(Boolean).join(' ')
    const vehPart = veh ? ` ${tipo} ${veh}` : ` ${tipo}`
    return `${greeting(name)}, te contactamos desde CampersNova sobre tu${vehPart}. ¿Tienes un momento para hablar?`
  }
  return `${greeting(name)}, te contactamos desde CampersNova. ¿Tienes un momento para hablar?`
}

export function buyerWhatsAppMessage(name: string | null | undefined): string {
  return `${greeting(name)}, te contactamos desde CampersNova. Tenemos vehículos que podrían interesarte. ¿Tienes un momento para hablar?`
}
