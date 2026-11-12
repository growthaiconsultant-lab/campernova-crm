import { test, expect } from '@playwright/test'

// ── Landing page ─────────────────────────────────────────────────────────────

test.describe('Landing page /', () => {
  for (const width of [1440, 390]) {
    test(`opens the original public pages from the home menu at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      const routes = [
        ['Inicio', '/'],
        ['Comprar', '/comprar'],
        ['Búsqueda a medida', '/busqueda-bajo-pedido'],
        ['Vender', '/vender'],
        ['Cómo funciona', '/como-funciona'],
        ['Sobre nosotros', '/sobre'],
        ['Contacto', '/contacto'],
      ] as const
      for (const [label, href] of routes) {
        await page.goto('/')
        if (width < 761) await page.getByRole('button', { name: 'Menú' }).click()
        const link = page.locator('header').getByRole('link', { name: label, exact: true })
        await expect(link).toHaveAttribute('href', href)
        await link.click()
        await expect(page).toHaveURL(new URL(href, page.url()).href)
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      }
    })
  }

  test('shows the travel hero, workshop and public catalog', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/CampersNova/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hoy dormimos aquí.')
    await page.getByRole('link', { name: 'Ver campers disponibles' }).click()
    await expect(page).toHaveURL(/#comprar$/)
    await expect(page.getByRole('link', { name: 'Ver todo el catálogo' })).toBeVisible()
    await page.getByRole('button', { name: 'Autocaravanas', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Autocaravanas', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect(page.getByText('Tienda online · Próximamente')).toBeAttached()
  })
})

// ── Chat page /comprar ────────────────────────────────────────────────────────

test.describe('Chat page /comprar', () => {
  test('shows heading and textarea in pre-session state', async ({ page }) => {
    await page.goto('/comprar')
    await expect(page).toHaveTitle(/CampersNova/)
    await expect(page.getByText('Búsqueda guiada')).toBeVisible()
    await expect(page.getByPlaceholder('Iniciando sesión segura…')).toBeVisible()
  })

  test('shows initial empty chat state before session starts', async ({ page }) => {
    await page.goto('/comprar')
    await expect(page.getByText('Cuéntale al asistente qué buscas. Tarda 2 minutos.')).toBeVisible()
  })

  test('sidebar shows Esteban advisor card', async ({ page }) => {
    await page.goto('/comprar')
    await expect(page.getByText('Esteban · Campers Nova')).toBeVisible()
  })
})

// ── Vehicle detail /comprar/[id] ──────────────────────────────────────────────

test.describe('Vehicle detail /comprar/[id]', () => {
  test('shows vehicle title, price and spec grid', async ({ page }) => {
    await page.goto('/comprar/vw-cali-coast')
    await expect(page).toHaveTitle(/Volkswagen California Coast/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Volkswagen California Coast'
    )
    await expect(page.getByText('64.900')).toBeVisible()
    await expect(page.getByText('Solicitar información')).toBeVisible()
  })

  test('breadcrumb links back to comprar', async ({ page }) => {
    await page.goto('/comprar/vw-cali-coast')
    const breadcrumb = page.getByRole('navigation').filter({ hasText: 'Comprar' }).first()
    await expect(breadcrumb.getByRole('link', { name: 'Inicio' })).toBeVisible()
    await expect(breadcrumb.getByRole('link', { name: 'Comprar' })).toBeVisible()
  })

  test('spec grid shows 8 technical specs', async ({ page }) => {
    await page.goto('/comprar/vw-cali-coast')
    await expect(page.getByText('Kilómetros')).toBeVisible()
    await expect(page.getByText('Combustible')).toBeVisible()
    await expect(page.getByText('Plazas viaje')).toBeVisible()
  })

  test('Nova Assistant badge is present', async ({ page }) => {
    await page.goto('/comprar/vw-cali-coast')
    await expect(page.getByText('Nova Assistant incluido')).toBeVisible()
  })

  test('unknown vehicle returns 404', async ({ page }) => {
    const response = await page.goto('/comprar/nonexistent-slug')
    expect(response?.status()).toBe(404)
  })

  test('each dummy vehicle detail page loads', async ({ page }) => {
    const ids = [
      'vw-cali-coast',
      'fiat-ducato-globe',
      'mercedes-marco-polo',
      'renault-trafic-spaceclass',
      'ford-transit-nugget',
      'knaus-boxstar',
    ]
    for (const id of ids) {
      const response = await page.goto(`/comprar/${id}`)
      expect(response?.status()).toBe(200)
      await expect(page.getByText('Solicitar información')).toBeVisible()
    }
  })
})

// ── Vender page ───────────────────────────────────────────────────────────────

test.describe('Vender page /vender', () => {
  test('loads wizard with step 1 heading', async ({ page }) => {
    await page.goto('/vender')
    await expect(page).toHaveTitle(/Vender/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Vende tu camper o autocaravana'
    )
  })

  test('shows comparison table and benefits section', async ({ page }) => {
    await page.goto('/vender')
    await expect(page.getByText('Tasación profesional')).toBeVisible()
  })
})

// ── Cómo funciona ─────────────────────────────────────────────────────────────

test.describe('/como-funciona', () => {
  test('loads with both buy and sell columns', async ({ page }) => {
    await page.goto('/como-funciona')
    await expect(page).toHaveTitle(/Cómo funciona/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Un proceso claro de principio a fin'
    )
    await expect(page.getByText('Si quieres comprar')).toBeVisible()
    await expect(page.getByText('Si quieres vender')).toBeVisible()
  })

  test('shows 8 numbered steps (01–04 × 2 columns)', async ({ page }) => {
    await page.goto('/como-funciona')
    const stepNums = await page.getByText(/^0[1-4]$/).all()
    expect(stepNums.length).toBe(8)
  })
})

// ── Sobre nosotros ────────────────────────────────────────────────────────────

test.describe('/sobre', () => {
  test('loads with mission section and visit block', async ({ page }) => {
    await page.goto('/sobre')
    await expect(page).toHaveTitle(/Sobre nosotros/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Nacimos viajando')
    await expect(page.getByText('Lo que nos mueve')).toBeVisible()
    await expect(page.getByText('Pásate por la nave')).toBeVisible()
  })
})

// ── Contacto ──────────────────────────────────────────────────────────────────

test.describe('/contacto', () => {
  test('shows four channel cards', async ({ page }) => {
    await page.goto('/contacto')
    await expect(page).toHaveTitle(/Contacto/)
    const main = page.getByRole('main')
    await expect(main.getByText('Teléfono')).toBeVisible()
    await expect(main.getByText('WhatsApp').first()).toBeVisible()
    await expect(main.getByText('Email').first()).toBeVisible()
    await expect(main.getByText('Instalaciones')).toBeVisible()
  })

  test('WhatsApp link points to correct number', async ({ page }) => {
    await page.goto('/contacto')
    const waLink = page.getByRole('main').getByRole('link', { name: /WhatsApp/ })
    await expect(waLink).toHaveAttribute('href', 'https://wa.me/34645639185')
  })
})

// ── Legal pages ───────────────────────────────────────────────────────────────

test.describe('Legal pages', () => {
  test('/aviso-legal loads with heading', async ({ page }) => {
    await page.goto('/aviso-legal')
    await expect(page).toHaveTitle(/Aviso Legal/)
    await expect(page.getByRole('heading', { level: 1, name: 'Aviso Legal' })).toBeVisible()
  })

  test('/privacidad loads with heading', async ({ page }) => {
    await page.goto('/privacidad')
    await expect(page).toHaveTitle(/Privacidad/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Política de Privacidad' })
    ).toBeVisible()
  })

  test('/cookies loads with heading', async ({ page }) => {
    await page.goto('/cookies')
    await expect(page).toHaveTitle(/Cookies/)
    await expect(page.getByRole('heading', { level: 1, name: 'Política de Cookies' })).toBeVisible()
  })
})
