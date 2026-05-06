/**
 * Service de cache client-side pour réduire l'Egress Supabase.
 * Utilise localStorage pour persister les données entre les sessions de navigation.
 */

const CACHE_PREFIX = 'sb_cache_';

export const cacheService = {
    /**
     * Stocke une donnée dans le cache avec un TTL.
     * @param {string} key - Clé unique pour la donnée.
     * @param {any} data - Donnée à stocker.
     * @param {number} ttlInMinutes - Durée de vie en minutes (par défaut 10).
     */
    set: (key, data, ttlInMinutes = 10) => {
        const expiresAt = Date.now() + ttlInMinutes * 60 * 1000;
        const cacheData = {
            data,
            expiresAt
        };
        localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(cacheData));
    },

    /**
     * Récupère une donnée du cache si elle n'est pas expirée.
     * @param {string} key - Clé unique.
     * @returns {any|null} - La donnée ou null si expirée/absente.
     */
    get: (key) => {
        const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
        if (!raw) return null;

        try {
            const cacheData = JSON.parse(raw);
            if (Date.now() > cacheData.expiresAt) {
                localStorage.removeItem(`${CACHE_PREFIX}${key}`);
                return null;
            }
            return cacheData.data;
        } catch (e) {
            console.error("Cache parsing error", e);
            return null;
        }
    },

    /**
     * Supprime une clé spécifique du cache.
     */
    remove: (key) => {
        localStorage.removeItem(`${CACHE_PREFIX}${key}`);
    },

    /**
     * Supprime toutes les entrées de cache gérées par ce service.
     */
    clearAll: () => {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith(CACHE_PREFIX)) {
                localStorage.removeItem(key);
            }
        });
    }
};
