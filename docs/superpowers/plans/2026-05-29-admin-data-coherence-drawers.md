# Admin Mock Data Coherence + Drawers Cliente/Pago — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extraer todos los datos mock del admin a un `MockAdminDataService` compartido con 20 órdenes/pagos coherentes, refactorizar `admin-home` para consumirlo, y crear drawers de detalle para Clientes y Pagos.

**Architecture:** Un servicio `@Injectable({ providedIn: 'root' })` centraliza todas las entidades con cross-references (order.customerId → customer, payment.orderId → order). `admin-home` inyecta el servicio y elimina sus arrays inline. Dos nuevos componentes standalone (`ClienteDetailComponent`, `PagoDetailComponent`) reciben un ID por `@Input()` y resuelven sus datos del servicio.

**Tech Stack:** Angular 17+ standalone components, signals, `@Input()` / `@Output()`, `inject()`, `CommonModule`, `FormsModule`

---

## Mapa de archivos

| Acción | Archivo | Responsabilidad |
|--------|---------|----------------|
| Crear | `src/app/core/services/mock-admin-data.service.ts` | Interfaces + todos los arrays de datos + 4 helpers |
| Crear | `src/app/pages/admin/clientes/cliente-detail.component.ts` | Drawer de detalle/edición de cliente |
| Crear | `src/app/pages/admin/clientes/cliente-detail.component.html` | Template del drawer |
| Crear | `src/app/pages/admin/clientes/cliente-detail.component.scss` | Estilos del drawer |
| Crear | `src/app/pages/admin/pagos/pago-detail.component.ts` | Drawer de detalle de pago |
| Crear | `src/app/pages/admin/pagos/pago-detail.component.html` | Template del drawer |
| Crear | `src/app/pages/admin/pagos/pago-detail.component.scss` | Estilos del drawer |
| Modificar | `src/app/pages/admin/admin-home.component.ts` | Inyectar servicio, eliminar arrays inline, agregar signals/computeds |
| Modificar | `src/app/pages/admin/admin-home.component.html` | Click handlers en filas, KPIs computados, renderizar drawers |

---

## Task 1: MockAdminDataService

**Files:**
- Create: `src/app/core/services/mock-admin-data.service.ts`

- [ ] **Crear el servicio completo**

```typescript
import { Injectable } from '@angular/core';

// ── Interfaces exportadas ────────────────────────────────────────────────────

export interface Customer {
  id: string; nombre: string; email: string; phone: string;
  ciudad: string; direccion: string; tag: string;
  since: string; // ISO date 'YYYY-MM-DD'
  orders: number; spent: number;
}

export interface Order {
  id: string; customerId: string; customer: string; email: string;
  items: number; total: number; status: string; shipping: string;
  date: string; city: string; method: string;
}

export interface Payment {
  id: string; orderId: string; order: string; date: string;
  method: string; amount: number; fee: number; net: number; status: string;
}

export interface Product {
  id: string; sku: string; name: string; category: string;
  character: string; price: number; stock: number;
  status: string; flag: string | null; color: string; updated: string;
}

export interface Character {
  id: string; name: string; region: string; color: string; accent: string;
}

export interface Category { id: string; label: string; }

export interface ToneStyle { bg: string; fg: string; }

// ── Servicio ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class MockAdminDataService {

  readonly CUSTOMERS: Customer[] = [
    { id: 'C-401', nombre: 'Mariana Restrepo',     email: 'mariana.r@gmail.com',    phone: '+57 311 444 2891', ciudad: 'Medellín',     direccion: 'Cra 43A # 14-50, Apto 802', since: '2026-03-15', orders: 4, spent: 487000, tag: 'VIP'        },
    { id: 'C-389', nombre: 'Diana Cárdenas',       email: 'diana@studio.co',        phone: '+57 320 551 0034', ciudad: 'Cali',         direccion: 'Av. 6N # 24-12',             since: '2026-01-10', orders: 7, spent: 982000, tag: 'VIP'        },
    { id: 'C-377', nombre: 'Jhon Sebastián López', email: 'jslopez@correo.co',      phone: '+57 314 222 8801', ciudad: 'Bogotá',       direccion: 'Cra 15 # 88-64, Apto 301',  since: '2026-04-20', orders: 2, spent: 178000, tag: 'Activo'     },
    { id: 'C-365', nombre: 'Camilo Henao',         email: 'camihenao@gmail.com',    phone: '+57 316 889 4412', ciudad: 'Manizales',    direccion: 'Cll 54 # 23-10',             since: '2026-02-08', orders: 2, spent: 268000, tag: 'Activo'     },
    { id: 'C-358', nombre: 'Laura Patiño',         email: 'lpatino@correo.co',      phone: '+57 300 774 1209', ciudad: 'Bogotá',       direccion: 'Cra 7 # 72-41',              since: '2026-05-13', orders: 1, spent: 0,      tag: 'Devolución' },
    { id: 'C-341', nombre: 'Andrés Quintero',      email: 'a.quintero@gmail.com',   phone: '+57 312 003 5566', ciudad: 'Barranquilla', direccion: 'Cll 72 # 44-50',             since: '2026-02-15', orders: 2, spent: 196000, tag: 'Activo'     },
    { id: 'C-329', nombre: 'Valentina Ruiz',       email: 'valru@correo.co',        phone: '+57 318 662 9987', ciudad: 'Pereira',      direccion: 'Cra 13 # 15-26',             since: '2026-05-12', orders: 1, spent: 0,      tag: 'Fallido'    },
    { id: 'C-318', nombre: 'Carolina Mejía',       email: 'caro.mejia@outlook.com', phone: '+57 315 445 7723', ciudad: 'Bucaramanga',  direccion: 'Cll 48 # 35-90, Casa 12',   since: '2025-12-05', orders: 5, spent: 412000, tag: 'Activo'     },
  ];

  // 20 órdenes con customerId que referencia CUSTOMERS
  // Coherencia: sum(paid orders) por cliente ≈ customer.spent
  // Diana (C-389) tiene 7 órdenes lifetime, solo 3 visibles aquí — ver customer.orders
  readonly ORDERS: Order[] = [
    { id: '#CQ-2819', customerId: 'C-389', customer: 'Diana Cárdenas',        email: 'diana@studio.co',           items: 2, total: 168000, status: 'paid',     shipping: 'pending',   date: '2026-05-16 09:30', city: 'Cali',         method: 'Bold · Tarjeta'         },
    { id: '#CQ-2818', customerId: 'C-318', customer: 'Carolina Mejía',        email: 'caro.mejia@outlook.com',    items: 1, total: 92000,  status: 'paid',     shipping: 'delivered', date: '2026-05-15 18:45', city: 'Bucaramanga',  method: 'PSE'                    },
    { id: '#CQ-2817', customerId: 'C-401', customer: 'Mariana Restrepo',      email: 'mariana.r@gmail.com',       items: 1, total: 89000,  status: 'paid',     shipping: 'shipped',   date: '2026-05-15 16:20', city: 'Medellín',     method: 'Nequi'                  },
    { id: '#CQ-2816', customerId: 'C-318', customer: 'Carolina Mejía',        email: 'caro.mejia@outlook.com',    items: 1, total: 82000,  status: 'paid',     shipping: 'delivered', date: '2026-05-15 11:10', city: 'Bucaramanga',  method: 'Nequi'                  },
    { id: '#CQ-2814', customerId: 'C-401', customer: 'Mariana Restrepo',      email: 'mariana.r@gmail.com',       items: 3, total: 159000, status: 'paid',     shipping: 'pending',   date: '2026-05-15 14:22', city: 'Medellín',     method: 'Bold · Tarjeta'         },
    { id: '#CQ-2813', customerId: 'C-377', customer: 'Jhon Sebastián López',  email: 'jslopez@correo.co',         items: 1, total: 89000,  status: 'paid',     shipping: 'shipped',   date: '2026-05-15 11:08', city: 'Bogotá',       method: 'PSE'                    },
    { id: '#CQ-2812', customerId: 'C-389', customer: 'Diana Cárdenas',        email: 'diana@studio.co',           items: 5, total: 312000, status: 'paid',     shipping: 'delivered', date: '2026-05-14 19:44', city: 'Cali',         method: 'Bold · Tarjeta'         },
    { id: '#CQ-2811', customerId: 'C-318', customer: 'Carolina Mejía',        email: 'caro.mejia@outlook.com',    items: 2, total: 110000, status: 'pending',  shipping: 'pending',   date: '2026-05-14 16:30', city: 'Bucaramanga',  method: 'Contra-entrega'         },
    { id: '#CQ-2810', customerId: 'C-341', customer: 'Andrés Quintero',       email: 'a.quintero@gmail.com',      items: 1, total: 148000, status: 'paid',     shipping: 'shipped',   date: '2026-05-14 10:12', city: 'Barranquilla', method: 'Nequi'                  },
    { id: '#CQ-2809', customerId: 'C-358', customer: 'Laura Patiño',          email: 'lpatino@correo.co',         items: 4, total: 234000, status: 'refunded', shipping: 'returned',  date: '2026-05-13 09:01', city: 'Bogotá',       method: 'Bold · Tarjeta'         },
    { id: '#CQ-2808', customerId: 'C-365', customer: 'Camilo Henao',          email: 'camihenao@gmail.com',       items: 2, total: 134000, status: 'paid',     shipping: 'delivered', date: '2026-05-12 18:55', city: 'Manizales',    method: 'PSE'                    },
    { id: '#CQ-2807', customerId: 'C-329', customer: 'Valentina Ruiz',        email: 'valru@correo.co',           items: 3, total: 198000, status: 'failed',   shipping: 'pending',   date: '2026-05-12 15:20', city: 'Pereira',      method: 'Bold · Tarjeta'         },
    { id: '#CQ-2806', customerId: 'C-389', customer: 'Diana Cárdenas',        email: 'diana@studio.co',           items: 3, total: 148000, status: 'paid',     shipping: 'delivered', date: '2026-05-11 14:00', city: 'Cali',         method: 'Bold · Mastercard •8812' },
    { id: '#CQ-2805', customerId: 'C-318', customer: 'Carolina Mejía',        email: 'caro.mejia@outlook.com',    items: 3, total: 148000, status: 'paid',     shipping: 'delivered', date: '2026-05-10 10:30', city: 'Bucaramanga',  method: 'Bold · Tarjeta'         },
    { id: '#CQ-2804', customerId: 'C-401', customer: 'Mariana Restrepo',      email: 'mariana.r@gmail.com',       items: 2, total: 124000, status: 'paid',     shipping: 'delivered', date: '2026-05-09 16:15', city: 'Medellín',     method: 'PSE'                    },
    { id: '#CQ-2803', customerId: 'C-377', customer: 'Jhon Sebastián López',  email: 'jslopez@correo.co',         items: 1, total: 89000,  status: 'paid',     shipping: 'delivered', date: '2026-05-08 12:00', city: 'Bogotá',       method: 'Bold · Tarjeta'         },
    { id: '#CQ-2802', customerId: 'C-318', customer: 'Carolina Mejía',        email: 'caro.mejia@outlook.com',    items: 1, total: 90000,  status: 'paid',     shipping: 'delivered', date: '2026-05-07 09:45', city: 'Bucaramanga',  method: 'Nequi'                  },
    { id: '#CQ-2797', customerId: 'C-401', customer: 'Mariana Restrepo',      email: 'mariana.r@gmail.com',       items: 1, total: 115000, status: 'paid',     shipping: 'delivered', date: '2026-05-02 14:30', city: 'Medellín',     method: 'Bold · Tarjeta'         },
    { id: '#CQ-2795', customerId: 'C-365', customer: 'Camilo Henao',          email: 'camihenao@gmail.com',       items: 2, total: 134000, status: 'paid',     shipping: 'delivered', date: '2026-04-28 11:20', city: 'Manizales',    method: 'PSE · Davivienda'       },
    { id: '#CQ-2793', customerId: 'C-341', customer: 'Andrés Quintero',       email: 'a.quintero@gmail.com',      items: 1, total: 48000,  status: 'paid',     shipping: 'delivered', date: '2026-04-25 16:00', city: 'Barranquilla', method: 'Nequi'                  },
  ];

  // 20 pagos — 1:1 con órdenes. payment.amount === order.total
  readonly PAYMENTS: Payment[] = [
    { id: 'PAY-09820', orderId: '#CQ-2819', order: '#CQ-2819', date: '2026-05-16 09:30', method: 'Bold · Visa •7734',        amount: 168000, fee: 5040, net: 162960,  status: 'paid'     },
    { id: 'PAY-09819', orderId: '#CQ-2818', order: '#CQ-2818', date: '2026-05-15 18:45', method: 'PSE · Bancolombia',        amount: 92000,  fee: 1840, net: 90160,   status: 'paid'     },
    { id: 'PAY-09818', orderId: '#CQ-2817', order: '#CQ-2817', date: '2026-05-15 16:20', method: 'Nequi',                    amount: 89000,  fee: 890,  net: 88110,   status: 'paid'     },
    { id: 'PAY-09817', orderId: '#CQ-2816', order: '#CQ-2816', date: '2026-05-15 11:10', method: 'Nequi',                    amount: 82000,  fee: 820,  net: 81180,   status: 'paid'     },
    { id: 'PAY-09812', orderId: '#CQ-2814', order: '#CQ-2814', date: '2026-05-15 14:22', method: 'Bold · Visa •4421',        amount: 159000, fee: 4770, net: 154230,  status: 'paid'     },
    { id: 'PAY-09811', orderId: '#CQ-2813', order: '#CQ-2813', date: '2026-05-15 11:08', method: 'PSE · Bancolombia',        amount: 89000,  fee: 1780, net: 87220,   status: 'paid'     },
    { id: 'PAY-09810', orderId: '#CQ-2812', order: '#CQ-2812', date: '2026-05-14 19:44', method: 'Bold · Mastercard •8812',  amount: 312000, fee: 9360, net: 302640,  status: 'paid'     },
    { id: 'PAY-09809', orderId: '#CQ-2811', order: '#CQ-2811', date: '2026-05-14 16:30', method: 'Contra-entrega',           amount: 110000, fee: 0,    net: 110000,  status: 'pending'  },
    { id: 'PAY-09808', orderId: '#CQ-2810', order: '#CQ-2810', date: '2026-05-14 10:12', method: 'Nequi',                    amount: 148000, fee: 1480, net: 146520,  status: 'paid'     },
    { id: 'PAY-09807', orderId: '#CQ-2809', order: '#CQ-2809', date: '2026-05-13 09:01', method: 'Bold · Visa •2210',        amount: 234000, fee: 7020, net: -234000, status: 'refunded' },
    { id: 'PAY-09806', orderId: '#CQ-2808', order: '#CQ-2808', date: '2026-05-12 18:55', method: 'PSE · Davivienda',         amount: 134000, fee: 2680, net: 131320,  status: 'paid'     },
    { id: 'PAY-09805', orderId: '#CQ-2807', order: '#CQ-2807', date: '2026-05-12 15:20', method: 'Bold · Visa •7723',        amount: 198000, fee: 0,    net: 0,       status: 'failed'   },
    { id: 'PAY-09804', orderId: '#CQ-2806', order: '#CQ-2806', date: '2026-05-11 14:00', method: 'Bold · Mastercard •8812',  amount: 148000, fee: 4440, net: 143560,  status: 'paid'     },
    { id: 'PAY-09803', orderId: '#CQ-2805', order: '#CQ-2805', date: '2026-05-10 10:30', method: 'Bold · Tarjeta •9901',     amount: 148000, fee: 4440, net: 143560,  status: 'paid'     },
    { id: 'PAY-09802', orderId: '#CQ-2804', order: '#CQ-2804', date: '2026-05-09 16:15', method: 'PSE · Bancolombia',        amount: 124000, fee: 2480, net: 121520,  status: 'paid'     },
    { id: 'PAY-09801', orderId: '#CQ-2803', order: '#CQ-2803', date: '2026-05-08 12:00', method: 'Bold · Visa •4421',        amount: 89000,  fee: 2670, net: 86330,   status: 'paid'     },
    { id: 'PAY-09800', orderId: '#CQ-2802', order: '#CQ-2802', date: '2026-05-07 09:45', method: 'Nequi',                    amount: 90000,  fee: 900,  net: 89100,   status: 'paid'     },
    { id: 'PAY-09793', orderId: '#CQ-2797', order: '#CQ-2797', date: '2026-05-02 14:30', method: 'Bold · Visa •4421',        amount: 115000, fee: 3450, net: 111550,  status: 'paid'     },
    { id: 'PAY-09791', orderId: '#CQ-2795', order: '#CQ-2795', date: '2026-04-28 11:20', method: 'PSE · Davivienda',         amount: 134000, fee: 2680, net: 131320,  status: 'paid'     },
    { id: 'PAY-09789', orderId: '#CQ-2793', order: '#CQ-2793', date: '2026-04-25 16:00', method: 'Nequi',                    amount: 48000,  fee: 480,  net: 47520,   status: 'paid'     },
  ];

  readonly PRODUCTS: Product[] = [
    { id: 'CQV-0042', sku: 'TEE-CUAC-EXP', name: 'El explorador soñador',        category: 'tee',     character: 'cuac',       price: 89000,  stock: 64,  status: 'active', flag: 'Drop semana', color: 'rio',   updated: 'Hace 2h'  },
    { id: 'CQV-0041', sku: 'PIN-KIKI-001', name: 'Kiki la delfín',                category: 'pin',     character: 'kiki',       price: 22000,  stock: 180, status: 'active', flag: 'Nuevo',       color: 'rosa',  updated: 'Hace 5h'  },
    { id: 'CQV-0040', sku: 'TOT-YEI-001', name: 'Yeison al río',                  category: 'tote',    character: 'yeison',     price: 54000,  stock: 22,  status: 'active', flag: null,          color: 'sol',   updated: 'Ayer'     },
    { id: 'CQV-0039', sku: 'LIB-ROAR-A5', name: 'Diario de páramo',               category: 'libreta', character: 'roar',       price: 48000,  stock: 6,   status: 'low',    flag: null,          color: 'bone',  updated: 'Hace 3d'  },
    { id: 'CQV-0038', sku: 'PEL-TIB-28',  name: 'Tiburcio el vacilón',            category: 'peluche', character: 'tiburcio',   price: 148000, stock: 12,  status: 'active', flag: 'Ed. 200',     color: 'cream', updated: 'Hace 1d'  },
    { id: 'CQV-0037', sku: 'STK-ABE-PK',  name: 'Pack stickers Abejandro',        category: 'sticker', character: 'abejandro',  price: 18000,  stock: 240, status: 'active', flag: null,          color: 'terra', updated: 'Hace 4d'  },
    { id: 'CQV-0036', sku: 'POS-COL-A2',  name: 'Vuelo de colibrí · A2',          category: 'poster',  character: 'colibriana', price: 38000,  stock: 0,   status: 'out',    flag: 'Agotado',     color: 'selva', updated: 'Hace 6d'  },
    { id: 'CQV-0035', sku: 'TZA-ATO-001', name: 'Taza marimbera',                  category: 'taza',    character: 'atolita',    price: 36000,  stock: 48,  status: 'draft',  flag: 'Borrador',    color: 'lila',  updated: 'Hace 1s'  },
    { id: 'CQV-0034', sku: 'TEE-KIK-RIO', name: 'Camiseta del río rosado',         category: 'tee',     character: 'kiki',       price: 92000,  stock: 38,  status: 'active', flag: null,          color: 'rosa',  updated: 'Hace 1s'  },
    { id: 'CQV-0033', sku: 'LIB-CUA-A6',  name: 'Bitácora migratoria · A6',        category: 'libreta', character: 'cuac',       price: 32000,  stock: 92,  status: 'active', flag: null,          color: 'rio',   updated: 'Hace 2s'  },
  ];

  readonly CHARACTERS: Character[] = [
    { id: 'cuac',       name: 'Cuac',       region: 'Migratorio · CA',    color: 'rio',   accent: '#2A6FDB' },
    { id: 'yeison',     name: 'Yeison',     region: 'Llanos · Casanare',  color: 'sol',   accent: '#B07820' },
    { id: 'roar',       name: 'Roar',       region: 'Andes · Boyacá',     color: 'bone',  accent: '#151F28' },
    { id: 'kiki',       name: 'Kiki',       region: 'Amazonas · Leticia', color: 'rosa',  accent: '#FF6FA8' },
    { id: 'abejandro',  name: 'Abejandro',  region: 'Cundinamarca',       color: 'terra', accent: '#E8623D' },
    { id: 'atolita',    name: 'Atolita',    region: 'Pacífico · Chocó',   color: 'lila',  accent: '#8B6FD8' },
    { id: 'colibriana', name: 'Colibriana', region: 'Eje cafetero',       color: 'selva', accent: '#1F8A5B' },
    { id: 'tiburcio',   name: 'Tiburcio',   region: 'Caribe · BAQ',       color: 'cream', accent: '#2E8FB8' },
  ];

  readonly CATEGORIES: Category[] = [
    { id: 'tee',     label: 'Camisetas' },
    { id: 'libreta', label: 'Libretas'  },
    { id: 'sticker', label: 'Stickers'  },
    { id: 'pin',     label: 'Pines'     },
    { id: 'tote',    label: 'Totes'     },
    { id: 'poster',  label: 'Posters'   },
    { id: 'peluche', label: 'Peluches'  },
    { id: 'taza',    label: 'Tazas'     },
  ];

  readonly TONE: Record<string, ToneStyle> = {
    rio:   { bg: '#C9D9F6', fg: '#2A6FDB' },
    rosa:  { bg: '#FCE0EC', fg: '#FF6FA8' },
    sol:   { bg: '#FCEFC2', fg: '#B07820' },
    selva: { bg: '#D7EBDD', fg: '#1F8A5B' },
    terra: { bg: '#FBE0D5', fg: '#E8623D' },
    lila:  { bg: '#E5DDF7', fg: '#8B6FD8' },
    bone:  { bg: '#D4DCE4', fg: '#151F28' },
    cream: { bg: '#DDE3EA', fg: '#151F28' },
  };

  readonly STATUS_BADGE: Record<string, { tone: string; label: string }> = {
    active:    { tone: 'ok',   label: 'Activo'       },
    low:       { tone: 'warn', label: 'Stock bajo'   },
    out:       { tone: 'err',  label: 'Agotado'      },
    draft:     { tone: '',     label: 'Borrador'      },
    paid:      { tone: 'ok',   label: 'Pagado'       },
    pending:   { tone: 'warn', label: 'Pendiente'    },
    refunded:  { tone: 'lila', label: 'Reembolsado'  },
    failed:    { tone: 'err',  label: 'Fallido'      },
    shipped:   { tone: 'rio',  label: 'Enviado'      },
    delivered: { tone: 'ok',   label: 'Entregado'    },
    returned:  { tone: 'err',  label: 'Devuelto'     },
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────

  getCustomer(id: string): Customer | undefined {
    return this.CUSTOMERS.find(c => c.id === id);
  }

  getOrdersByCustomer(customerId: string): Order[] {
    return this.ORDERS.filter(o => o.customerId === customerId);
  }

  getOrderById(id: string): Order | undefined {
    return this.ORDERS.find(o => o.id === id);
  }

  getPaymentById(pagoId: string): Payment | undefined {
    return this.PAYMENTS.find(p => p.id === pagoId);
  }

  getPaymentByOrder(orderId: string): Payment | undefined {
    return this.PAYMENTS.find(p => p.orderId === orderId);
  }

  // KPI helpers — ventana de 7 días relativa a la orden más reciente (2026-05-16)
  private readonly KPI_CUTOFF = new Date('2026-05-09T00:00:00');

  totalIngresos7d(): number {
    return this.ORDERS
      .filter(o => o.status === 'paid' && new Date(o.date) >= this.KPI_CUTOFF)
      .reduce((sum, o) => sum + o.total, 0);
  }

  totalPedidos7d(): number {
    return this.ORDERS.filter(o => new Date(o.date) >= this.KPI_CUTOFF).length;
  }

  clientesNuevos7d(): number {
    return this.CUSTOMERS.filter(c => new Date(c.since) >= this.KPI_CUTOFF).length;
  }

  ticketPromedio7d(): number {
    const paid = this.ORDERS.filter(o => o.status === 'paid' && new Date(o.date) >= this.KPI_CUTOFF);
    if (!paid.length) return 0;
    return Math.round(paid.reduce((s, o) => s + o.total, 0) / paid.length);
  }

  fmtSince(iso: string): string {
    const d = new Date(iso);
    const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    return months[d.getMonth()] + ' ' + d.getFullYear();
  }
}
```

- [ ] **Commit**

```bash
git add src/app/core/services/mock-admin-data.service.ts
git commit -m "feat(admin): MockAdminDataService — 20 órdenes/pagos coherentes + helpers"
```

---

## Task 2: Refactor admin-home.component.ts

**Files:**
- Modify: `src/app/pages/admin/admin-home.component.ts`

This task replaces all inline `readonly` data arrays with service injection, adds drawer signals, and adds KPI computed signals. Read the current file before editing.

- [ ] **Reemplazar el bloque de imports y el inicio de la clase**

El archivo actual importa tipos de interfaces locales. Reemplazar la sección de interfaces y el inicio de la clase con lo siguiente (mantener los métodos de navegación, drawer states, filtros y product editor form sin cambios):

Cambios en los imports al inicio del archivo:

```typescript
import { Component, computed, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminStateService, ViewId } from '../../core/services/admin-state.service';
import { MockAdminDataService, Customer, Order, Payment, Product, Character, Category, ToneStyle } from '../../core/services/mock-admin-data.service';
import { ClienteDetailComponent } from './clientes/cliente-detail.component';
import { PagoDetailComponent }    from './pagos/pago-detail.component';
```

- [ ] **Reemplazar la declaración `@Component`**

```typescript
@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [CommonModule, FormsModule, ClienteDetailComponent, PagoDetailComponent],
  templateUrl: './admin-home.component.html',
  styleUrl: './admin-home.component.scss',
})
export class AdminHomeComponent implements OnDestroy {

  private adminState = inject(AdminStateService);
  private data       = inject(MockAdminDataService);

  // ── Navigation ─────────────────────────────────────────────────────────────
  view = this.adminState.view;
```

- [ ] **Reemplazar toda la sección `// ── Static data ──`**

Eliminar los arrays `readonly CHARACTERS`, `CATEGORIES`, `SIZES`, `PRODUCTS`, `ORDERS`, `ORDER_DETAIL`, `CUSTOMERS`, `PAYMENTS`, `GATEWAYS`, `TONE`, `STATUS_BADGE` del componente, y reemplazarlos con:

```typescript
  // ── Data from service ─────────────────────────────────────────────────────
  readonly CHARACTERS  = this.data.CHARACTERS;
  readonly CATEGORIES  = this.data.CATEGORIES;
  readonly PRODUCTS    = this.data.PRODUCTS;
  readonly ORDERS      = this.data.ORDERS;
  readonly CUSTOMERS   = this.data.CUSTOMERS;
  readonly PAYMENTS    = this.data.PAYMENTS;
  readonly SIZES       = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

  // GATEWAYS permanece local — es data de presentación de UI, no de dominio
  readonly GATEWAYS: { name: string; state: string; tone: string; fee: string; count: number; color: string }[] = [
    { name: 'Bold',           state: 'Conectado', tone: 'ok',   fee: '3.0% + $300', count: 64, color: 'rio'   },
    { name: 'PSE',            state: 'Conectado', tone: 'ok',   fee: '1.99%',       count: 22, color: 'selva' },
    { name: 'Nequi',          state: 'Conectado', tone: 'ok',   fee: '1.0%',        count: 12, color: 'rosa'  },
    { name: 'Contra-entrega', state: 'Manual',    tone: 'warn', fee: '—',           count: 4,  color: 'sol'   },
  ];

  // ORDER_DETAIL se resuelve dinámicamente
  readonly ORDER_DETAIL = {
    id: '#CQ-2814', date: '2026-05-15 14:22',
    customer: { name: 'Mariana Restrepo', email: 'mariana.r@gmail.com', phone: '+57 311 444 2891', since: 'Marzo 2026', orders: 4 },
    shipping:  { address: 'Cra 43A # 14-50, Apto 802', city: 'Medellín, Antioquia', zip: '050021', carrier: 'Servientrega', tracking: 'SVT-887412339' },
    items: [
      { sku: 'TEE-CUAC-EXP', name: 'El explorador soñador', variant: 'Talla M · Cream', qty: 1, price: 89000,  color: 'rio',   label: 'Cuac' },
      { sku: 'PIN-KIKI-001', name: 'Kiki la delfín',         variant: 'Único',           qty: 2, price: 22000,  color: 'rosa',  label: 'Kiki' },
      { sku: 'STK-ABE-PK',  name: 'Pack stickers Abejandro', variant: '5 stickers',     qty: 1, price: 18000,  color: 'terra', label: 'Abe'  },
    ],
    totals: { subtotal: 151000, shipping: 12000, discount: 4000, total: 159000 },
    timeline: [
      { time: '14:22', title: 'Orden creada',    desc: 'Cliente completó el checkout',              state: 'done'   },
      { time: '14:22', title: 'Pago aprobado',   desc: 'Bold · Visa terminada en 4421 · $159.000', state: 'done'   },
      { time: '15:01', title: 'En preparación',  desc: 'Asignado al lote del lunes',               state: 'active' },
      { time: '—',     title: 'Despacho',         desc: 'Pendiente · Servientrega',                 state: 'wait'   },
      { time: '—',     title: 'Entrega',           desc: 'Estimado 18 mayo',                         state: 'wait'   },
    ],
  };

  // ── Drawer signals para Cliente y Pago ─────────────────────────────────────
  clienteId = signal<string | null>(null);
  pagoId    = signal<string | null>(null);

  openCliente(id: string) { this.clienteId.set(id); }
  closeCliente()          { this.clienteId.set(null); }
  openPago(id: string)    { this.pagoId.set(id); }
  closePago()             { this.pagoId.set(null); }

  // ── KPI computados desde el servicio ────────────────────────────────────────
  readonly kpiIngresos7d  = computed(() => this.data.totalIngresos7d());
  readonly kpiPedidos7d   = computed(() => this.data.totalPedidos7d());
  readonly kpiClientes7d  = computed(() => this.data.clientesNuevos7d());
  readonly kpiTicket7d    = computed(() => this.data.ticketPromedio7d());
```

- [ ] **Actualizar los helpers `tone()`, `sb()`, `char()`, `cat()` para usar el servicio**

Reemplazar los 4 métodos helper que accedían a los arrays locales:

```typescript
  tone(key: string): ToneStyle  { return this.data.TONE[key] ?? this.data.TONE['cream']; }
  sb(s: string): { tone: string; label: string } { return this.data.STATUS_BADGE[s] ?? { tone: '', label: s }; }
  char(id: string): Character   { return this.data.CHARACTERS.find(c => c.id === id) ?? this.data.CHARACTERS[0]; }
  cat(id: string):  Category    { return this.data.CATEGORIES.find(c => c.id === id) ?? this.data.CATEGORIES[0]; }
```

- [ ] **Commit**

```bash
git add src/app/pages/admin/admin-home.component.ts
git commit -m "refactor(admin-home): inject MockAdminDataService, add drawer signals + KPI computed"
```

---

## Task 3: Actualizar admin-home.component.html

**Files:**
- Modify: `src/app/pages/admin/admin-home.component.html`

- [ ] **Reemplazar KPI del dashboard con computed signals**

En el `@case ('dashboard')`, los 4 `.kpi-n` tienen strings hardcodeados. Reemplazar:

```html
<!-- Antes: -->
<div class="kpi-n">$3.482.000</div>
<!-- Después: -->
<div class="kpi-n">{{ fmtCOP(kpiIngresos7d()) }}</div>
```

```html
<!-- Antes: -->
<div class="kpi-n">124</div>
<!-- Después: -->
<div class="kpi-n">{{ kpiPedidos7d() }}</div>
```

```html
<!-- Antes: -->
<div class="kpi-n">38</div>
<!-- Después: -->
<div class="kpi-n">{{ kpiClientes7d() }}</div>
```

```html
<!-- Antes: -->
<div class="kpi-n">$28.080</div>
<!-- Después: -->
<div class="kpi-n">{{ fmtCOP(kpiTicket7d()) }}</div>
```

- [ ] **Agregar (click) en filas de la tabla Clientes**

En el `@case ('clientes')`, la tabla de clientes tiene `<tr>` sin click handler. Agregar en cada `<tr>`:

```html
<!-- Antes: -->
@for (c of CUSTOMERS; track c.id) {
<tr>
<!-- Después: -->
@for (c of CUSTOMERS; track c.id) {
<tr (click)="openCliente(c.id)" style="cursor:pointer">
```

- [ ] **Agregar (click) en filas de la tabla Pagos**

En el `@case ('pagos')`, la tabla de movimientos tiene `<tr>` sin click handler:

```html
<!-- Antes: -->
@for (p of PAYMENTS; track p.id) {
<tr>
<!-- Después: -->
@for (p of PAYMENTS; track p.id) {
<tr (click)="openPago(p.id)" style="cursor:pointer">
```

- [ ] **Agregar drawers al final del template**

Al final del archivo, justo antes del `<!-- ══ TOAST ══ -->`, agregar:

```html
<!-- ══ CLIENTE DETAIL DRAWER ═══════════════════════════════════════════════ -->
@if (clienteId()) {
<app-cliente-detail [clienteId]="clienteId()!" (close)="closeCliente()" />
}

<!-- ══ PAGO DETAIL DRAWER ══════════════════════════════════════════════════ -->
@if (pagoId()) {
<app-pago-detail [pagoId]="pagoId()!" (close)="closePago()" />
}
```

- [ ] **Commit**

```bash
git add src/app/pages/admin/admin-home.component.html
git commit -m "feat(admin-home): KPIs computados, click en clientes/pagos, drawers"
```

---

## Task 4: ClienteDetailComponent

**Files:**
- Create: `src/app/pages/admin/clientes/cliente-detail.component.ts`
- Create: `src/app/pages/admin/clientes/cliente-detail.component.html`
- Create: `src/app/pages/admin/clientes/cliente-detail.component.scss`

- [ ] **Crear `cliente-detail.component.ts`**

```typescript
import { Component, Input, Output, EventEmitter, OnChanges, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MockAdminDataService, Customer, Order } from '../../../core/services/mock-admin-data.service';

@Component({
  selector: 'app-cliente-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cliente-detail.component.html',
  styleUrl: './cliente-detail.component.scss',
})
export class ClienteDetailComponent implements OnChanges {
  @Input() clienteId!: string;
  @Output() close = new EventEmitter<void>();

  private data = inject(MockAdminDataService);

  customer  = signal<Customer | null>(null);
  orders    = signal<Order[]>([]);

  editEmail     = signal('');
  editPhone     = signal('');
  editCiudad    = signal('');
  editDireccion = signal('');
  saving        = signal(false);
  saved         = signal(false);

  ngOnChanges() {
    const c = this.data.getCustomer(this.clienteId) ?? null;
    this.customer.set(c);
    this.orders.set(this.data.getOrdersByCustomer(this.clienteId));
    if (c) {
      this.editEmail.set(c.email);
      this.editPhone.set(c.phone);
      this.editCiudad.set(c.ciudad);
      this.editDireccion.set(c.direccion);
    }
  }

  async guardar() {
    this.saving.set(true);
    await new Promise(r => setTimeout(r, 800));
    this.saving.set(false);
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2000);
  }

  ticketPromedio(): number {
    const pagadas = this.orders().filter(o => o.status === 'paid');
    if (!pagadas.length) return 0;
    return Math.round(pagadas.reduce((s, o) => s + o.total, 0) / pagadas.length);
  }

  initials(nombre: string): string {
    return nombre.split(' ').map(s => s[0] ?? '').slice(0, 2).join('').toUpperCase();
  }

  fmtCOP(n: number): string {
    return '$' + n.toLocaleString('es-CO');
  }

  fmtSince(iso: string): string {
    return this.data.fmtSince(iso);
  }

  tagTone(tag: string): string {
    const map: Record<string, string> = { VIP: 'warn', Activo: 'ok', Devolución: 'lila', Fallido: 'err' };
    return map[tag] ?? '';
  }

  sb(s: string) { return this.data.STATUS_BADGE[s] ?? { tone: '', label: s }; }
}
```

- [ ] **Crear `cliente-detail.component.html`**

```html
<div class="drawer-back on" (click)="close.emit()"></div>
<div class="drawer on">
  @if (customer(); as c) {
  <div class="drawer-h">
    <div style="display:flex;align-items:center;gap:14px">
      <div class="thumb" style="width:44px;height:44px;border-radius:12px;background:var(--cream-2);color:var(--carbon);font-size:18px;display:grid;place-items:center;font-family:var(--display);flex-shrink:0">{{ initials(c.nombre) }}</div>
      <div>
        <h2 style="margin:0">{{ c.nombre }} <span class="badge" [class]="tagTone(c.tag)" style="vertical-align:middle;margin-left:6px"><span class="pdot"></span>{{ c.tag }}</span></h2>
        <div style="font-size:12px;color:var(--carbon-50);margin-top:2px">Cliente desde {{ fmtSince(c.since) }}</div>
      </div>
    </div>
    <button class="drawer-close" (click)="close.emit()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
    </button>
  </div>
  <div class="drawer-b">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s-4);align-items:start">

      <!-- Izquierda: contacto + historial -->
      <div style="display:flex;flex-direction:column;gap:var(--s-4)">

        <div class="panel">
          <div class="panel-h"><h3>Contacto</h3></div>
          <div class="panel-b" style="display:flex;flex-direction:column;gap:var(--s-3)">
            <div class="field">
              <label>Email</label>
              <input class="input" type="email" [value]="editEmail()" (input)="editEmail.set($any($event.target).value)" />
            </div>
            <div class="field">
              <label>Teléfono</label>
              <input class="input" [value]="editPhone()" (input)="editPhone.set($any($event.target).value)" />
            </div>
            <div class="field">
              <label>Ciudad</label>
              <input class="input" [value]="editCiudad()" (input)="editCiudad.set($any($event.target).value)" />
            </div>
            <div class="field">
              <label>Dirección</label>
              <input class="input" [value]="editDireccion()" (input)="editDireccion.set($any($event.target).value)" />
            </div>
            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px">
              <button class="btn-sm solid" [disabled]="saving()" (click)="guardar()">
                @if (saving()) { Guardando… }
                @else if (saved()) { <svg style="width:12px;height:12px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m5 12 5 5L20 7"/></svg> Guardado }
                @else { Guardar cambios }
              </button>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-h"><h3>Pedidos recientes</h3><span class="sub">{{ orders().length }} en este historial</span></div>
          <div class="panel-b flush">
            @if (orders().length === 0) {
            <div style="padding:var(--s-5);text-align:center;color:var(--carbon-50);font-size:13px">Sin pedidos</div>
            } @else {
            <table class="tbl">
              <thead><tr><th>Orden</th><th class="num">Total</th><th>Estado</th><th>Fecha</th></tr></thead>
              <tbody>
                @for (o of orders(); track o.id) {
                <tr>
                  <td><span class="id" style="color:var(--carbon);font-weight:600">{{ o.id }}</span></td>
                  <td class="num">{{ fmtCOP(o.total) }}</td>
                  <td><span class="badge" [class]="sb(o.status).tone"><span class="pdot"></span>{{ sb(o.status).label }}</span></td>
                  <td><span class="id">{{ o.date.slice(0, 10) }}</span></td>
                </tr>
                }
              </tbody>
            </table>
            }
          </div>
        </div>

      </div>

      <!-- Derecha: stats -->
      <div class="panel" style="align-self:flex-start">
        <div class="panel-h"><h3>Estadísticas</h3></div>
        <div class="panel-b" style="display:flex;flex-direction:column;gap:14px">
          <div>
            <div style="font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--carbon-50)">Total gastado (lifetime)</div>
            <div style="font-family:var(--display);font-size:28px;margin-top:4px;line-height:1">{{ fmtCOP(c.spent) }}</div>
          </div>
          <div style="padding-top:12px;border-top:1px dashed var(--carbon-08)">
            <div style="font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--carbon-50)">Pedidos totales</div>
            <div style="font-family:var(--display);font-size:28px;margin-top:4px;line-height:1">{{ c.orders }}</div>
          </div>
          <div style="padding-top:12px;border-top:1px dashed var(--carbon-08)">
            <div style="font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--carbon-50)">Ticket promedio (visibles)</div>
            <div style="font-family:var(--display);font-size:28px;margin-top:4px;line-height:1">{{ fmtCOP(ticketPromedio()) }}</div>
          </div>
          <div style="padding-top:12px;border-top:1px dashed var(--carbon-08)">
            <div style="font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--carbon-50)">Cliente desde</div>
            <div style="font-size:14px;font-weight:600;margin-top:4px">{{ fmtSince(c.since) }}</div>
          </div>
          <div style="padding-top:12px;border-top:1px dashed var(--carbon-08);display:flex;flex-direction:column;gap:6px">
            <button class="btn-sm ghost" style="justify-content:center">Enviar carta</button>
            <button class="btn-sm danger" style="justify-content:center">Suspender cuenta</button>
          </div>
        </div>
      </div>

    </div>
  </div>
  <div class="drawer-f">
    <span style="font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;color:var(--carbon-50);text-transform:uppercase;align-self:center">ID {{ c.id }}</span>
    <button class="btn-sm ghost" (click)="close.emit()">Cerrar</button>
  </div>
  }
</div>
```

- [ ] **Crear `cliente-detail.component.scss`** (vacío — usa clases globales del admin)

```scss
:host { display: contents; }
```

- [ ] **Commit**

```bash
git add src/app/pages/admin/clientes/
git commit -m "feat(admin): ClienteDetailComponent — drawer con contacto editable, historial, stats"
```

---

## Task 5: PagoDetailComponent

**Files:**
- Create: `src/app/pages/admin/pagos/pago-detail.component.ts`
- Create: `src/app/pages/admin/pagos/pago-detail.component.html`
- Create: `src/app/pages/admin/pagos/pago-detail.component.scss`

- [ ] **Crear `pago-detail.component.ts`**

```typescript
import { Component, Input, Output, EventEmitter, OnChanges, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MockAdminDataService, Payment, Order, Customer } from '../../../core/services/mock-admin-data.service';

@Component({
  selector: 'app-pago-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pago-detail.component.html',
  styleUrl: './pago-detail.component.scss',
})
export class PagoDetailComponent implements OnChanges {
  @Input() pagoId!: string;
  @Output() close = new EventEmitter<void>();

  private data = inject(MockAdminDataService);

  payment  = signal<Payment | null>(null);
  order    = signal<Order | null>(null);
  customer = signal<Customer | null>(null);

  actionDone = signal<string | null>(null);

  ngOnChanges() {
    const p = this.data.getPaymentById(this.pagoId) ?? null;
    this.payment.set(p);
    if (p) {
      const o = this.data.getOrderById(p.orderId) ?? null;
      this.order.set(o);
      if (o) {
        this.customer.set(this.data.getCustomer(o.customerId) ?? null);
      }
    }
  }

  async marcarPagado() {
    this.actionDone.set('Pago marcado como pagado');
    setTimeout(() => this.actionDone.set(null), 2500);
  }

  async emitirReembolso() {
    this.actionDone.set('Reembolso iniciado');
    setTimeout(() => this.actionDone.set(null), 2500);
  }

  async cancelar() {
    this.actionDone.set('Pago cancelado');
    setTimeout(() => this.actionDone.set(null), 2500);
  }

  fmtCOP(n: number): string {
    return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('es-CO');
  }

  sb(s: string) { return this.data.STATUS_BADGE[s] ?? { tone: '', label: s }; }
}
```

- [ ] **Crear `pago-detail.component.html`**

```html
<div class="drawer-back on" (click)="close.emit()"></div>
<div class="drawer on" style="width:min(560px,94vw)">
  @if (payment(); as p) {
  <div class="drawer-h">
    <div>
      <div class="crumbs-admin"><span>Pagos</span><span class="sep">/</span><strong>{{ p.id }}</strong></div>
      <h2>{{ fmtCOP(p.amount) }} <span style="margin-left:10px;vertical-align:middle"><span class="badge" [class]="sb(p.status).tone"><span class="pdot"></span>{{ sb(p.status).label }}</span></span></h2>
    </div>
    <button class="drawer-close" (click)="close.emit()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
    </button>
  </div>
  <div class="drawer-b" style="display:flex;flex-direction:column;gap:var(--s-4)">

    @if (order(); as o) {
    <div class="panel">
      <div class="panel-h"><h3>Orden vinculada</h3></div>
      <div class="panel-b">
        <div class="kv-list">
          <div class="kv"><span class="k">Número</span><span class="v" style="font-family:var(--mono);font-weight:600">{{ o.id }}</span></div>
          <div class="kv"><span class="k">Items</span><span class="v">{{ o.items }} producto(s)</span></div>
          <div class="kv"><span class="k">Método</span><span class="v">{{ o.method }}</span></div>
          <div class="kv"><span class="k">Ciudad</span><span class="v">{{ o.city }}</span></div>
          <div class="kv"><span class="k">Fecha</span><span class="v">{{ o.date }}</span></div>
          <div class="kv"><span class="k">Estado envío</span>
            <span class="v"><span class="badge" [class]="sb(o.shipping).tone"><span class="pdot"></span>{{ sb(o.shipping).label }}</span></span>
          </div>
        </div>
      </div>
    </div>
    }

    @if (customer(); as c) {
    <div class="panel">
      <div class="panel-h"><h3>Cliente</h3></div>
      <div class="panel-b">
        <div style="font-family:var(--display);font-size:20px;line-height:1.1;margin-bottom:4px">{{ c.nombre }}</div>
        <div style="font-size:13px;color:var(--carbon-70)">{{ c.email }}</div>
        <div style="font-family:var(--mono);font-size:11.5px;color:var(--carbon-50);margin-top:3px">{{ c.phone }}</div>
        <div style="margin-top:var(--s-3);padding-top:var(--s-3);border-top:1px dashed var(--carbon-08);display:flex;justify-content:space-between;font-size:12px">
          <span style="color:var(--carbon-50)">{{ c.orders }} pedidos totales</span>
          <span style="font-weight:600">{{ fmtCOP(c.spent) }} gastado</span>
        </div>
      </div>
    </div>
    }

    <div class="panel">
      <div class="panel-h"><h3>Desglose financiero</h3></div>
      <div class="panel-b flush">
        <table class="tbl">
          <thead><tr><th>Concepto</th><th class="num">Monto</th></tr></thead>
          <tbody>
            <tr><td>Monto bruto</td><td class="num">{{ fmtCOP(p.amount) }}</td></tr>
            <tr><td>Comisión pasarela</td><td class="num" style="color:var(--carbon-50)">-{{ fmtCOP(p.fee) }}</td></tr>
            <tr style="font-weight:700"><td><strong>Neto</strong></td><td class="num" [style.color]="p.net < 0 ? 'var(--terra)' : 'var(--carbon)'"><strong>{{ fmtCOP(p.net) }}</strong></td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="panel">
      <div class="panel-h"><h3>Acciones</h3></div>
      <div class="panel-b" style="display:flex;flex-direction:column;gap:8px">
        @if (actionDone()) {
        <div style="padding:10px 14px;background:var(--cream-2);border-radius:8px;font-size:13px;color:var(--selva);font-weight:500">
          <svg style="width:14px;height:14px;vertical-align:middle;margin-right:6px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m5 12 5 5L20 7"/></svg>
          {{ actionDone() }}
        </div>
        }
        @if (p.status === 'pending') {
        <button class="btn-sm solid" style="justify-content:center" (click)="marcarPagado()">Marcar como pagado</button>
        <button class="btn-sm danger" style="justify-content:center" (click)="cancelar()">Cancelar pago</button>
        }
        @if (p.status === 'paid') {
        <button class="btn-sm ghost" style="justify-content:center" (click)="emitirReembolso()">Emitir reembolso</button>
        }
        <button class="btn-sm ghost" style="justify-content:center">Descargar comprobante</button>
      </div>
    </div>

  </div>
  <div class="drawer-f">
    <span style="font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;color:var(--carbon-50);text-transform:uppercase;align-self:center">{{ p.date }}</span>
    <button class="btn-sm ghost" (click)="close.emit()">Cerrar</button>
  </div>
  }
</div>
```

- [ ] **Crear `pago-detail.component.scss`** (vacío — usa clases globales)

```scss
:host { display: contents; }
```

- [ ] **Commit**

```bash
git add src/app/pages/admin/pagos/
git commit -m "feat(admin): PagoDetailComponent — drawer con orden, cliente, desglose y acciones"
```

---

## Task 6: Verificación final

**Files:**
- No new files

- [ ] **Build de verificación**

```bash
npx ng build --configuration development 2>&1 | tail -15
```

Esperado: `Application bundle generation complete` sin errores.

- [ ] **Verificar coherencia de datos**

Un build limpio garantiza que todas las referencias de tipos son válidas. Adicionalmente, verificar manualmente en el browser:
- `/admin` → Clientes → click en cualquier fila → abre drawer con nombre, email, historial de pedidos
- `/admin` → Pagos → click en cualquier fila → abre drawer con monto, orden vinculada, cliente
- `/admin` → Dashboard → los 4 KPIs muestran valores numéricos reales (no strings hardcodeados)

- [ ] **Commit final si hay cambios sin commitear**

```bash
git status
git add -A
git commit -m "feat(admin): data coherence + drawers cliente/pago — verificación final"
```
