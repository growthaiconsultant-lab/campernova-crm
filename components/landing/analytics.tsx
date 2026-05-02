'use client'

import { useEffect, useRef } from 'react'
import posthog from 'posthog-js'

// Fires landing_view on mount.
// Scroll-triggered events use IntersectionObserver to stay lightweight.
export function LandingAnalytics() {
  const firedRef = useRef(false)
  const comparisonRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true

    // landing_view
    posthog.capture('landing_view')

    // hero_cta_click
    const heroCta = document.querySelector<HTMLAnchorElement>('a[href="/#calculadora"]')
    heroCta?.addEventListener('click', () => posthog.capture('hero_cta_click'), { once: true })

    // final_cta_click
    const finalCta = document.querySelectorAll<HTMLAnchorElement>('a[href="/#calculadora"]')
    finalCta.forEach((el, i) => {
      if (i > 0) {
        el.addEventListener('click', () => posthog.capture('final_cta_click'), { once: true })
      }
    })

    // comparison_section_viewed
    const comparisonSection = document.querySelector<HTMLElement>('section:has(table)')
    if (comparisonSection) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            posthog.capture('comparison_section_viewed')
            observer.disconnect()
          }
        },
        { threshold: 0.3 }
      )
      observer.observe(comparisonSection)
      comparisonRef.current = comparisonSection
    }

    // whatsapp_button_click
    const waBtn = document.querySelector<HTMLAnchorElement>('a[href^="https://wa.me"]')
    waBtn?.addEventListener('click', () => posthog.capture('whatsapp_button_click'), { once: true })

    // faq_opened — delegate on FAQ section
    const faqSection = document.querySelector<HTMLElement>('#preguntas')
    faqSection?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button[aria-expanded]')
      if (btn && btn.getAttribute('aria-expanded') === 'false') {
        const question = btn.querySelector('span')?.textContent ?? ''
        posthog.capture('faq_opened', { question })
      }
    })
  }, [])

  return null
}
