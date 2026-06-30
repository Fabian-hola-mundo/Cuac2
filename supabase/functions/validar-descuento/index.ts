// supabase/functions/validar-descuento/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { codigo, subtotal, items } = await req.json()
    // items: { id: string; categoria: string; precio: number; cantidad: number }[]

    if (
      typeof codigo !== 'string' || !codigo.trim() ||
      typeof subtotal !== 'number' || subtotal <= 0 ||
      !Array.isArray(items) || items.length === 0
    ) {
      return json({ valido: false, mensaje: 'Solicitud inválida' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: dc, error } = await supabase
      .from('codigos_descuento')
      .select('*')
      .eq('codigo', codigo.toUpperCase().trim())
      .single()

    if (error || !dc) return json({ valido: false, mensaje: 'Código inválido' })

    if (!dc.activo) return json({ valido: false, mensaje: 'Código inválido' })

    if (dc.expira_en && new Date(dc.expira_en) < new Date()) {
      return json({ valido: false, mensaje: 'Código expirado' })
    }

    if (dc.limite_usos !== null && dc.usos_actuales >= dc.limite_usos) {
      return json({ valido: false, mensaje: 'Límite de usos alcanzado' })
    }

    if (subtotal < dc.minimo_orden) {
      return json({
        valido: false,
        mensaje: `Monto mínimo $${dc.minimo_orden.toLocaleString('es-CO')} COP`,
      })
    }

    // Filtrar items elegibles
    let itemsElegibles: typeof items = items
    if (dc.productos_ids && dc.productos_ids.length > 0) {
      itemsElegibles = items.filter((i: any) => dc.productos_ids.includes(i.id))
      if (itemsElegibles.length === 0) {
        return json({ valido: false, mensaje: 'No aplica para los productos en tu carrito' })
      }
    } else if (dc.categorias_ids && dc.categorias_ids.length > 0) {
      itemsElegibles = items.filter((i: any) => dc.categorias_ids.includes(i.categoria))
      if (itemsElegibles.length === 0) {
        return json({ valido: false, mensaje: 'No aplica para los productos en tu carrito' })
      }
    }

    const subtotalElegible = itemsElegibles.reduce(
      (acc: number, i: any) => acc + i.precio * i.cantidad, 0
    )

    const monto_descuento = dc.tipo === 'porcentaje'
      ? Math.round(subtotalElegible * dc.valor / 100)
      : Math.min(dc.valor, subtotal)

    return json({ valido: true, tipo: dc.tipo, valor: dc.valor, monto_descuento })

  } catch (err) {
    console.error(err)
    return json({ valido: false, mensaje: 'Error interno del servidor' }, 500)
  }
})
