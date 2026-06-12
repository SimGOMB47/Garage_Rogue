// ── Configuration Supabase ──────────────────────────────────────
//
// Où trouver ces valeurs dans le tableau de bord Supabase :
//  - URL du projet : ⚙ Project Settings → Data API → "Project URL"
//  - Clé publique  : ⚙ Project Settings → API Keys
//                    → "Publishable key" (commence par sb_publishable_)
//
// La clé publishable est faite pour être visible dans le code du
// site : c'est la sécurité RLS côté serveur qui protège les données.
// Ne JAMAIS mettre ici la clé "secret" (sb_secret_...).

export const SUPABASE_URL = 'https://jzycsdzylkfywyjowjmi.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_Z17qEBnRToyM1ICECxd5cQ_KzN5N1Kt';

// ── Seuils d'alerte des échéances (code couleur) ────────────────
export const WARN_KM = 500;   // orange si l'échéance est à moins de 500 km
export const WARN_DAYS = 30;  // orange si l'échéance est à moins de 30 jours
