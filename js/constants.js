// ── Listes de valeurs utilisées dans les formulaires ───────────

export const VEHICLE_STATUS = [
  { value: 'en_service',   label: 'En service' },
  { value: 'maintenance',  label: 'En maintenance' },
  { value: 'hors_service', label: 'Hors service' },
];

export const OT_TYPES = [
  { value: 'preventif',   label: 'Préventif' },
  { value: 'correctif',   label: 'Correctif' },
  { value: 'amelioratif', label: 'Amélioratif' },
];

export const OT_STATUS = [
  { value: 'planifie', label: 'Planifié' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'cloture',  label: 'Clôturé' },
];

// Suggestions de sous-ensembles (champ libre : on peut taper autre chose)
export const SUBSYSTEMS = [
  'Moteur', 'Boîte / Transmission', 'Embrayage', 'Freinage',
  'Suspension / Train roulant', 'Direction', 'Électricité',
  'Refroidissement', 'Échappement', 'Carburant', 'Hydraulique',
  'Pneumatiques', 'Carrosserie', 'Entretien courant', 'Autre',
];

// Retrouve le libellé français d'une valeur stockée en base
export const label = (list, value) =>
  list.find(o => o.value === value)?.label ?? value ?? '';

// ── Définition des formulaires ──────────────────────────────────

export const vehicleFields = [
  { name: 'name',   label: 'Nom', required: true, placeholder: 'ex : Clio de Papa' },
  { name: 'brand',  label: 'Marque', placeholder: 'ex : Renault' },
  { name: 'model',  label: 'Modèle', placeholder: 'ex : Clio 2' },
  { name: 'year',   label: 'Année', type: 'number', step: '1' },
  { name: 'plate',  label: 'Immatriculation', placeholder: 'AB-123-CD' },
  { name: 'km',     label: 'Kilométrage', type: 'number', step: '1', required: true },
  { name: 'status', label: 'Statut', type: 'select', options: VEHICLE_STATUS },
  { name: 'type',   label: 'Type', datalist: ['Voiture', 'Moto', 'Bateau', 'Tracteur', 'Utilitaire', 'Remorque', 'Quad'] },
];

// Symbole affiché selon le type de véhicule (champ libre : on
// compare en minuscules ; type inconnu ou vide → 🚗)
const VEHICLE_ICONS = {
  voiture:    '🚗',
  moto:       '🏍️',
  bateau:     '🛥️',
  tracteur:   '🚜',
  utilitaire: '🚐',
  remorque:   '🚚',
  quad:       '🛞',
};
export const vehicleIcon = type =>
  VEHICLE_ICONS[String(type ?? '').trim().toLowerCase()] ?? '🚗';

// Formulaire « Modifier l'activité ». L'ancienne colonne `date` n'y
// figure plus : la période est décrite par date_debut / date_fin, les
// deux obligatoires. La colonne `date` reste en base comme filet de
// sécurité (elle est recopiée depuis date_debut à l'enregistrement).
export const otFields = [
  { name: 'type',        label: 'Type d’intervention', type: 'select', options: OT_TYPES },
  { name: 'subsystem',   label: 'Intitulé', datalist: SUBSYSTEMS },
  { name: 'date_debut',  label: 'Date de début', type: 'date', required: true },
  { name: 'date_fin',    label: 'Date de fin', type: 'date', required: true },
  { name: 'km',          label: 'Kilométrage', type: 'number', step: '1' },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'statut',      label: 'Statut', type: 'select', options: OT_STATUS },
];

// Contrôle commun à tous les endroits qui saisissent une période.
// Renvoie un message en français, ou null si tout va bien.
export function verifierPeriode({ date_debut, date_fin }) {
  if (!date_debut || !date_fin) return 'Les deux dates sont obligatoires.';
  if (date_fin < date_debut) return 'La date de fin ne peut pas être avant la date de début.';
  return null;
}

export const deadlineFields = [
  { name: 'title',    label: 'Intitulé', required: true, placeholder: 'ex : Vidange moteur' },
  { name: 'due_km',   label: 'Échéance kilométrique (km)', type: 'number', step: '1', placeholder: 'optionnel' },
  { name: 'due_date', label: 'Échéance par date', type: 'date' },
  { name: 'notes',    label: 'Notes', type: 'textarea' },
];

export const stockFields = [
  { name: 'name',  label: 'Pièce', required: true, placeholder: 'ex : Filtre à huile' },
  { name: 'ref',   label: 'Référence' },
  { name: 'qty',   label: 'Quantité en stock', type: 'number', required: true },
  { name: 'price', label: 'Prix unitaire (€)', type: 'number' },
];

export const specFields = [
  { name: 'label', label: 'Nom de la fiche', required: true, placeholder: 'ex : Huile moteur' },
  { name: 'brand', label: 'Marque', placeholder: 'ex : Total' },
  { name: 'type',  label: 'Type', placeholder: 'ex : 5W30' },
  { name: 'qty',   label: 'Quantité', placeholder: 'ex : 4,5 L' },
  { name: 'notes', label: 'Informations supplémentaires', type: 'textarea', rows: 6,
    placeholder: 'ex : référence du filtre, couple de serrage, où l’acheter…' },
  { name: 'photo', label: 'Photo', type: 'file' },
];
