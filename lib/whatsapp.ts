import { normalizePhone } from './phone'

export function formatPhoneForWhatsApp(phone: string): string {
  return normalizePhone(phone)
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const formatted = formatPhoneForWhatsApp(phone)
  return `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`
}

export function sellerWhatsAppMessage(
  name: string,
  vehicle?: { type: string; brand: string; model: string }
): string {
  if (vehicle) {
    const tipo = vehicle.type === 'CAMPER' ? 'camper' : 'autocaravana'
    return `Hola ${name}, te contactamos desde CampersNova sobre tu ${tipo} ${vehicle.brand} ${vehicle.model}. ¿Tienes un momento para hablar?`
  }
  return `Hola ${name}, te contactamos desde CampersNova. ¿Tienes un momento para hablar?`
}

export function buyerWhatsAppMessage(name: string): string {
  return `Hola ${name}, te contactamos desde CampersNova. Tenemos vehículos que podrían interesarte. ¿Tienes un momento para hablar?`
}
