// ── Accès aux données Supabase ──────────────────────────────────
// Toutes les lectures/écritures de l'application passent par ici.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Supabase renvoie { data, error } : ce petit utilitaire transforme
// l'erreur éventuelle en exception, que les écrans affichent en toast.
function check({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

// ── Cache mémoire (vitesse) ─────────────────────────────────────
// Chaque lecture est gardée en mémoire : revenir sur un écran ou
// changer d'onglet devient instantané, sans rappeler le serveur.
// Le cache est vidé à chaque écriture et à chaque changement reçu
// par la synchro temps réel : il n'est donc jamais périmé.
const cache = new Map();

function cached(key, fetcher) {
  if (!cache.has(key)) {
    const p = fetcher().catch(err => { cache.delete(key); throw err; });
    cache.set(key, p);
  }
  return cache.get(key);
}

export function clearCache() { cache.clear(); }

// ── Membres ─────────────────────────────────────────────────────
export async function isMember() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const rows = check(
    await supabase.from('garage_members').select('user_id').eq('user_id', user.id)
  );
  return rows.length > 0;
}

// ── Véhicules ───────────────────────────────────────────────────
export function listVehicles() {
  return cached('vehicles', async () => {
    const vehicles = check(await supabase.from('vehicles').select('*').order('name'));
    const costs = check(await supabase.from('vehicle_costs').select('*'));
    const costMap = Object.fromEntries(costs.map(c => [c.vehicle_id, Number(c.total_cost)]));
    return vehicles.map(v => ({ ...v, total_cost: costMap[v.id] ?? 0 }));
  });
}

export function getVehicle(id) {
  return cached(`vehicle:${id}`, async () =>
    check(await supabase.from('vehicles').select('*').eq('id', id).single())
  );
}

export function getVehicleCost(id) {
  return cached(`cost:${id}`, async () => {
    const rows = check(
      await supabase.from('vehicle_costs').select('total_cost').eq('vehicle_id', id)
    );
    return rows.length ? Number(rows[0].total_cost) : 0;
  });
}

export async function saveVehicle(values, id = null) {
  clearCache();
  if (id) return check(await supabase.from('vehicles').update(values).eq('id', id).select().single());
  return check(await supabase.from('vehicles').insert(values).select().single());
}

export async function deleteVehicle(id) {
  clearCache();
  // Supprime d'abord les fichiers photos de tous ses OT dans le Storage
  // (la base, elle, se nettoie toute seule grâce à "on delete cascade").
  const photos = check(
    await supabase.from('work_order_photos')
      .select('path, work_orders!inner(vehicle_id)')
      .eq('work_orders.vehicle_id', id)
  );
  if (photos.length) {
    await supabase.storage.from('photos').remove(photos.map(p => p.path));
  }
  // … puis sa photo de profil, si elle existe
  const v = check(await supabase.from('vehicles').select('photo_path').eq('id', id).single());
  if (v.photo_path) {
    await supabase.storage.from('photos').remove([v.photo_path]);
  }
  check(await supabase.from('vehicles').delete().eq('id', id));
}

// ── Photo de profil d'un véhicule ───────────────────────────────
export async function setVehiclePhoto(vehicle, file) {
  clearCache();
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `vehicles/${vehicle.id}/${crypto.randomUUID()}.${ext}`;
  check(await supabase.storage.from('photos').upload(path, file));
  check(await supabase.from('vehicles').update({ photo_path: path }).eq('id', vehicle.id));
  // L'ancienne photo est effacée après coup (si l'envoi a réussi)
  if (vehicle.photo_path) {
    await supabase.storage.from('photos').remove([vehicle.photo_path]);
  }
}

export async function removeVehiclePhoto(vehicle) {
  clearCache();
  check(await supabase.from('vehicles').update({ photo_path: null }).eq('id', vehicle.id));
  if (vehicle.photo_path) {
    await supabase.storage.from('photos').remove([vehicle.photo_path]);
  }
}

// ── Ordres de travail ───────────────────────────────────────────
export function listWorkOrders(vehicleId) {
  return cached(`ots:${vehicleId}`, async () =>
    check(
      await supabase.from('work_orders')
        .select('*, work_order_parts(qty, price)')
        .eq('vehicle_id', vehicleId)
        .order('date', { ascending: false })
    )
  );
}

// Toutes les activités, tous véhicules confondus (pour l'accueil et le planning)
export function listAllWorkOrders() {
  return cached('ots:all', async () =>
    check(
      await supabase.from('work_orders')
        .select('id, vehicle_id, subsystem, type, date, status, description')
        .order('date')
    )
  );
}

export function getWorkOrder(id) {
  return cached(`ot:${id}`, async () =>
    check(
      await supabase.from('work_orders')
        .select('*, work_order_parts(*), work_order_photos(*)')
        .eq('id', id)
        .single()
    )
  );
}

export async function saveWorkOrder(values, id = null) {
  clearCache();
  if (id) return check(await supabase.from('work_orders').update(values).eq('id', id).select().single());
  return check(await supabase.from('work_orders').insert(values).select().single());
}

export async function deleteWorkOrder(id) {
  clearCache();
  const photos = check(
    await supabase.from('work_order_photos').select('path').eq('work_order_id', id)
  );
  if (photos.length) {
    await supabase.storage.from('photos').remove(photos.map(p => p.path));
  }
  check(await supabase.from('work_orders').delete().eq('id', id));
}

// ── Pièces d'un ordre de travail ────────────────────────────────
export async function addPart(workOrderId, values) {
  clearCache();
  check(await supabase.from('work_order_parts').insert({ ...values, work_order_id: workOrderId }));
}

export async function deletePart(id) {
  clearCache();
  check(await supabase.from('work_order_parts').delete().eq('id', id));
}

// ── Photos ──────────────────────────────────────────────────────
export async function uploadPhotos(workOrderId, files) {
  clearCache();
  for (const file of files) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${workOrderId}/${crypto.randomUUID()}.${ext}`;
    check(await supabase.storage.from('photos').upload(path, file));
    check(await supabase.from('work_order_photos').insert({ work_order_id: workOrderId, path }));
  }
}

// Le bucket est privé : on génère des liens signés temporaires (1 h).
// Les liens sont gardés en mémoire 45 min : changer d'écran ne
// redemande pas de nouveaux liens au serveur.
const urlCache = new Map(); // chemin → { url, t }

export async function photoUrls(photos) {
  if (!photos.length) return {};
  const now = Date.now();
  const missing = photos.filter(p => {
    const e = urlCache.get(p.path);
    return !e || now - e.t > 45 * 60 * 1000;
  });
  if (missing.length) {
    const data = check(
      await supabase.storage.from('photos').createSignedUrls(missing.map(p => p.path), 3600)
    );
    data.forEach((d, i) => urlCache.set(missing[i].path, { url: d.signedUrl, t: now }));
  }
  const map = {};
  photos.forEach(p => { map[p.path] = urlCache.get(p.path)?.url; });
  return map;
}

export async function deletePhoto(photo) {
  clearCache();
  await supabase.storage.from('photos').remove([photo.path]);
  check(await supabase.from('work_order_photos').delete().eq('id', photo.id));
}

// ── Échéances ───────────────────────────────────────────────────
export function listDeadlines(vehicleId) {
  return cached(`due:${vehicleId}`, async () =>
    check(
      await supabase.from('deadlines').select('*')
        .eq('vehicle_id', vehicleId)
        .order('created_at')
    )
  );
}

export function listAllDeadlines() {
  return cached('due:all', async () =>
    check(
      await supabase.from('deadlines')
        .select('id, vehicle_id, title, due_km, due_date, notes, work_order_id')
    )
  );
}

export async function saveDeadline(values, id = null) {
  clearCache();
  if (id) check(await supabase.from('deadlines').update(values).eq('id', id));
  else check(await supabase.from('deadlines').insert(values));
}

export async function deleteDeadline(id) {
  clearCache();
  check(await supabase.from('deadlines').delete().eq('id', id));
}

// ── Échéances → activités automatiques ──────────────────────────
// Pour chaque échéance datée qui n'a pas encore créé son activité :
// si sa date est à moins d'un mois, on crée l'activité (préventive)
// et on note son identifiant sur l'échéance pour ne pas recommencer.
// Renvoie le nombre d'activités créées.
export async function generateDueActivities() {
  const dues = check(
    await supabase.from('deadlines').select('*')
      .is('work_order_id', null)
      .not('due_date', 'is', null)
  );

  const limit = new Date();
  limit.setDate(limit.getDate() + 30);   // aujourd'hui + 1 mois
  const limitISO = limit.toISOString().slice(0, 10);

  let created = 0;
  for (const d of dues) {
    if (d.due_date > limitISO) continue;   // encore trop loin
    const ot = check(
      await supabase.from('work_orders').insert({
        vehicle_id:  d.vehicle_id,
        type:        'preventif',
        date:        d.due_date,
        description: [d.title, d.notes].filter(Boolean).join('\n'),
        status:      'ouvert',
      }).select().single()
    );
    check(await supabase.from('deadlines').update({ work_order_id: ot.id }).eq('id', d.id));
    created++;
  }
  if (created) clearCache();
  return created;
}

// ── Stock ───────────────────────────────────────────────────────
export function listStock(vehicleId) {
  return cached(`stock:${vehicleId}`, async () =>
    check(
      await supabase.from('stock_parts').select('*')
        .eq('vehicle_id', vehicleId)
        .order('name')
    )
  );
}

export async function saveStockPart(values, id = null) {
  clearCache();
  if (id) check(await supabase.from('stock_parts').update(values).eq('id', id));
  else check(await supabase.from('stock_parts').insert(values));
}

export async function deleteStockPart(id) {
  clearCache();
  check(await supabase.from('stock_parts').delete().eq('id', id));
}

// ── Fiche technique ─────────────────────────────────────────────
export function listSpecs(vehicleId) {
  return cached(`specs:${vehicleId}`, async () =>
    check(
      await supabase.from('vehicle_specs').select('*')
        .eq('vehicle_id', vehicleId)
        .order('created_at')
    )
  );
}

export async function saveSpec(values, id = null) {
  clearCache();
  if (id) check(await supabase.from('vehicle_specs').update(values).eq('id', id));
  else check(await supabase.from('vehicle_specs').insert(values));
}

export async function deleteSpec(id) {
  clearCache();
  check(await supabase.from('vehicle_specs').delete().eq('id', id));
}

// ── Synchronisation temps réel ──────────────────────────────────
// Appelle "callback" dès qu'une ligne change dans la base
// (modification faite par l'autre personne, ou par soi-même).
// On vide aussi le cache : le prochain affichage relira le serveur.
export function onAnyChange(callback) {
  supabase
    .channel('garage-sync')
    .on('postgres_changes', { event: '*', schema: 'public' }, payload => {
      clearCache();
      callback(payload);
    })
    .subscribe();
}
