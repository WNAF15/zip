// Постоянное состояние мира хранит только ИЗМЕНЕНИЯ.
// Базовая статическая карта никогда не дублируется в localStorage.
export class WorldState {
    constructor(circleId = 1, storagePrefix = 'circleOfHellWorldState') {
        this.circleId = circleId;
        this.key = `${storagePrefix}:${circleId}`;
        this.tiles = new Map();
        this.chunkInfluence = new Map();
        this.removedObjects = new Set();
        this._dirty = false;
        this._saveTimer = null;
        this._storageAvailable = typeof localStorage !== 'undefined';
        this._load();
    }

    _load() {
        if (!this._storageAvailable) return;
        try {
            const raw = localStorage.getItem(this.key);
            if (!raw) return;
            const data = JSON.parse(raw);
            for (const [key, value] of Object.entries(data.tiles || {})) this.tiles.set(key, value);
            for (const [key, value] of Object.entries(data.chunkInfluence || {})) this.chunkInfluence.set(key, value);
            for (const id of data.removedObjects || []) this.removedObjects.add(id);
        } catch (error) {
            console.warn('[WorldState] Не удалось загрузить изменения мира', error);
        }
    }

    tileKey(x, y) { return `${x}:${y}`; }
    chunkKey(x, y) { return `${x}:${y}`; }

    getTileChange(x, y) { return this.tiles.get(this.tileKey(x, y)) || null; }
    setTileChange(x, y, value) {
        this.tiles.set(this.tileKey(x, y), { ...value, changedAt: Date.now() });
        this._dirty = true;
    }

    isObjectRemoved(id) { return this.removedObjects.has(id); }
    removeObject(id) { this.removedObjects.add(id); this._dirty = true; }

    getInfluence(chunkX, chunkY) {
        return this.chunkInfluence.get(this.chunkKey(chunkX, chunkY)) ||
            { violence: 0, civilization: 0, industry: 0, corruption: 0, nature: 0, natureType: 'normal' };
    }

    changeInfluence(chunkX, chunkY, changes = {}) {
        const current = this.getInfluence(chunkX, chunkY);
        const next = { ...current };
        for (const [key, value] of Object.entries(changes)) next[key] = (next[key] || 0) + value;
        next.natureType = this._resolveNature(next);
        this.chunkInfluence.set(this.chunkKey(chunkX, chunkY), next);
        this._dirty = true;
        return next;
    }

    _resolveNature(s) {
        if (s.violence >= 100) return 'bloody';
        if (s.civilization >= 80) return 'urban';
        if (s.industry >= 70) return 'industrial';
        return 'normal';
    }

    save({ immediate = false } = {}) {
        if (!this._dirty || !this._storageAvailable) return;
        if (!immediate) {
            if (this._saveTimer) return;
            this._saveTimer = setTimeout(() => {
                this._saveTimer = null;
                this.save({ immediate: true });
            }, 750);
            return;
        }
        if (this._saveTimer) { clearTimeout(this._saveTimer); this._saveTimer = null; }
        try {
            localStorage.setItem(this.key, JSON.stringify({
                tiles: Object.fromEntries(this.tiles),
                chunkInfluence: Object.fromEntries(this.chunkInfluence),
                removedObjects: [...this.removedObjects],
            }));
            this._dirty = false;
        } catch (error) {
            console.warn('[WorldState] Не удалось сохранить изменения мира', error);
        }
    }

    destroy() {
        this.save({ immediate: true });
        this.tiles.clear(); this.chunkInfluence.clear(); this.removedObjects.clear();
    }
}
