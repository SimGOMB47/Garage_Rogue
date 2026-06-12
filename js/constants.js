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
  { value: 'ouvert',   label: 'Ouvert' },
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
  { name: 'type',   label: 'Type', datalist: ['Voiture', 'Moto', 'Tracteur', 'Utilitaire', 'Remorque', 'Quad'] },
];

export const otFields = [
  { name: 'type',        label: 'Type d’intervention', type: 'select', options: OT_TYPES },
  { name: 'subsystem',   label: 'Sous-ensemble', datalist: SUBSYSTEMS },
  { name: 'date',        label: 'Date', type: 'date', required: true },
  { name: 'km',          label: 'Kilométrage', type: 'number', step: '1' },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'status',      label: 'Statut', type: 'select', options: OT_STATUS },
];

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
  { name: 'label', label: 'Caractéristique', required: true, placeholder: 'ex : Huile moteur' },
  { name: 'value', label: 'Valeur', placeholder: 'ex : 5W30 — 4,5 L' },
];
