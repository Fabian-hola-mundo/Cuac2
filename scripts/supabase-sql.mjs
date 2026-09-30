// scripts/supabase-sql.mjs
//
// Ejecuta SQL contra la Management API de Supabase. El MCP no tiene permiso
// sobre este proyecto, así que migraciones y pruebas SQL pasan por aquí.
//
//   node scripts/supabase-sql.mjs archivo.sql                 → ejecuta
//   node scripts/supabase-sql.mjs archivo.sql --read          → sólo lectura
//   node scripts/supabase-sql.mjs prueba.sql --test mig.sql   → begin; mig; prueba; rollback;
//
// El token va en SUPABASE_ACCESS_TOKEN y nunca en un archivo.
import { readFileSync } from 'node:fs';

const REF = 'ytqcwrjxlnlsjgnjxiiw';
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) { console.error('Falta SUPABASE_ACCESS_TOKEN'); process.exit(2); }

const args = process.argv.slice(2);
const archivo = args[0];
const soloLectura = args.includes('--read');
const iTest = args.indexOf('--test');

const sinTransaccion = sql => sql.replace(/^\s*(begin|commit)\s*;\s*$/gim, '');

let query = readFileSync(archivo, 'utf8');
if (iTest >= 0) {
  const migraciones = args.slice(iTest + 1).filter(a => !a.startsWith('--'));
  query = 'begin;\n'
    + migraciones.map(m => sinTransaccion(readFileSync(m, 'utf8'))).join('\n')
    + '\n' + sinTransaccion(query)
    + '\nrollback;\n';
}

const url = `https://api.supabase.com/v1/projects/${REF}/database/query${soloLectura ? '/read-only' : ''}`;
const res = await fetch(url, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
});
const texto = await res.text();
console.log(texto);
if (!res.ok) process.exit(1);
