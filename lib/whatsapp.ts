export function formatPhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  // 9 dígitos españoles (móvil 6xx/7xx) → añadir prefijo 34
  if (digits.length === 9 && (digits.startsWith('6') || digits.startsWith('7'))) {
    return `34${digits}`
  }
  // 0034xxx → quitar doble cero
  if (digits.startsWith('00')) return digits.slice(2)
  return digits
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
