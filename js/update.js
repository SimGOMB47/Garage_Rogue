// ── Mise à jour automatique de l'application (PWA) ──────────────
//
// Problème visé : sur iPhone, l'app installée reste en mémoire et
// peut afficher une vieille version pendant des jours. Ici :
//  1. au lancement ET à chaque retour au premier plan, on demande
//     au navigateur de vérifier si sw.js a changé sur le serveur ;
//  2. quand le nouveau service worker prend la main (il s'active
//     tout seul grâce à skipWaiting), on recharge la page pour
//     charger les nouveaux fichiers — sauf si une saisie est en
//     cours, auquel cas on attend la fermeture de la modale.

import { isModalOpen, toast } from './ui.js';

export function setupAutoUpdate() {
  if (!('serviceWorker' in navigator)) return;

  // updateViaCache: 'none' → sw.js est toujours relu depuis le
  // réseau, jamais depuis le cache HTTP (sinon iOS peut garder
  // l'ancien fichier jusqu'à 24 h).
  const registration = navigator.serviceWorker
    .register('./sw.js', { updateViaCache: 'none' });

  // iOS ne recharge pas l'app quand on la rouvre : il la sort de la
  // mémoire telle quelle. On profite donc de chaque retour au
  // premier plan pour vérifier s'il existe une nouvelle version.
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    try { (await registration).update(); }
    catch { /* hors ligne : on réessaiera à la prochaine ouverture */ }
  });

  // Au tout premier chargement, le service worker prend la main sans
  // qu'il y ait de "nouvelle version" : inutile de recharger.
  if (!navigator.serviceWorker.controller) return;

  let reloading = false;
  const reload = () => {
    if (reloading) return; // évite un double rechargement
    reloading = true;
    location.reload();
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (isModalOpen()) {
      // Ne pas perdre ce que l'utilisateur est en train de taper
      toast('Nouvelle version prête — appliquée après ta saisie');
      window.addEventListener('modal-closed', reload, { once: true });
    } else {
      toast('Mise à jour de l’application…');
      reload();
    }
  });
}
