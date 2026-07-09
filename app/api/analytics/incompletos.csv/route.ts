import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { getCalidadKpis } from '@/lib/kpi/calidad'

/**
 * Bloque F6 KPIs — export CSV de las fichas de vehículo incompletas (spec §17).
 * Autenticado; respeta el filtro de agente.
 */
export async function GET(req: Request) {
  let user
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!['ADMIN', 'AGENTE', 'MARKETING'].includes(user.role)) {
    return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
  }

  const agentParam = new URL(req.url).searchParams.get('agent')
  const filter = { agentId: user.role === 'ADMIN' ? agentParam : null }
  const q = await getCalidadKpis(db, filter)

  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`
  const lines = [
    'Vehiculo,Completitud,Ficha',
    ...q.incompleteRows.map((r) => [escape(r.name), escape(r.detail), escape(r.href)].join(',')),
  ]
  const csv = '﻿' + lines.join('\r\n') // BOM para Excel

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="vehiculos-incompletos.csv"',
    },
  })
}
