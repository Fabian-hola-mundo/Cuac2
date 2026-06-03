import { Injectable } from '@angular/core';

// ── Interfaces exportadas ────────────────────────────────────────────────────

export interface Customer {
  id: string; nombre: string; email: string; phone: string;
  ciudad: string; direccion: string; tag: string;
  since: string; // ISO date 'YYYY-MM-DD'
  last: string;  // última actividad, para mostrar en tabla
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
    { id: 'C-401', nombre: 'Mariana Restrepo',     email: 'mariana.r@gmail.com',    phone: '+57 311 444 2891', ciudad: 'Medellín',     direccion: 'Cra 43A # 14-50, Apto 802', since: '2026-03-15', last: 'Hoy',      orders: 4, spent: 487000, tag: 'VIP'        },
    { id: 'C-389', nombre: 'Diana Cárdenas',       email: 'diana@studio.co',        phone: '+57 320 551 0034', ciudad: 'Cali',         direccion: 'Av. 6N # 24-12',             since: '2026-01-10', last: 'Ayer',     orders: 7, spent: 982000, tag: 'VIP'        },
    { id: 'C-377', nombre: 'Jhon Sebastián López', email: 'jslopez@correo.co',      phone: '+57 314 222 8801', ciudad: 'Bogotá',       direccion: 'Cra 15 # 88-64, Apto 301',  since: '2026-04-20', last: 'Hoy',      orders: 2, spent: 178000, tag: 'Activo'     },
    { id: 'C-365', nombre: 'Camilo Henao',         email: 'camihenao@gmail.com',    phone: '+57 316 889 4412', ciudad: 'Manizales',    direccion: 'Cll 54 # 23-10',             since: '2026-02-08', last: 'Hace 3d',  orders: 2, spent: 268000, tag: 'Activo'     },
    { id: 'C-358', nombre: 'Laura Patiño',         email: 'lpatino@correo.co',      phone: '+57 300 774 1209', ciudad: 'Bogotá',       direccion: 'Cra 7 # 72-41',              since: '2026-05-13', last: 'Hace 2s',  orders: 1, spent: 0,      tag: 'Devolución' },
    { id: 'C-341', nombre: 'Andrés Quintero',      email: 'a.quintero@gmail.com',   phone: '+57 312 003 5566', ciudad: 'Barranquilla', direccion: 'Cll 72 # 44-50',             since: '2026-02-15', last: 'Hace 1d',  orders: 2, spent: 196000, tag: 'Activo'     },
    { id: 'C-329', nombre: 'Valentina Ruiz',       email: 'valru@correo.co',        phone: '+57 318 662 9987', ciudad: 'Pereira',      direccion: 'Cra 13 # 15-26',             since: '2026-05-12', last: 'Hace 4d',  orders: 1, spent: 0,      tag: 'Fallido'    },
    { id: 'C-318', nombre: 'Carolina Mejía',       email: 'caro.mejia@outlook.com', phone: '+57 315 445 7723', ciudad: 'Bucaramanga',  direccion: 'Cll 48 # 35-90, Casa 12',   since: '2025-12-05', last: 'Hace 1d',  orders: 5, spent: 412000, tag: 'Activo'     },
  ];

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
