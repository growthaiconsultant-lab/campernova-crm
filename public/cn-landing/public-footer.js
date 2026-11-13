/* El indicador se activa tanto en las campañas estáticas como al navegar por la web. */
if ('customElements' in window && !customElements.get('cn-footer-hours')) {
  const clock = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  })
  customElements.define(
    'cn-footer-hours',
    class extends HTMLElement {
      connectedCallback() {
        this.update()
        this.timer = setInterval(() => this.update(), 60000)
      }
      disconnectedCallback() {
        clearInterval(this.timer)
      }
      update() {
        const parts = Object.fromEntries(
          clock.formatToParts(new Date()).map((p) => [p.type, p.value])
        )
        const closing = parts.weekday === 'Sun' ? 0 : parts.weekday === 'Sat' ? 13 : 19
        const hour = Number(parts.hour)
        const open = hour >= 10 && hour < closing
        const next = closing && hour < 10 ? 'hoy' : parts.weekday === 'Sat' ? 'el lunes' : 'mañana'
        const status = open ? 'Abierto ahora' : 'Cerrado ahora'
        const detail = open ? 'Hasta las ' + closing + ':00' : 'Abrimos ' + next + ' a las 10:00'
        if (this.dataset.status === detail) return
        const dot = document.createElement('span')
        dot.className = 'pie-pt'
        const text = document.createElement('span')
        text.className = 'pie-tx'
        const label = document.createElement('b')
        label.textContent = status
        const sub = document.createElement('small')
        sub.textContent = detail
        text.append(label, sub)
        this.replaceChildren(dot, text)
        this.classList.toggle('abierto', open)
        this.dataset.status = detail
        this.hidden = false
      }
    }
  )
}
