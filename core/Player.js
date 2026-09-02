export class Player {
    constructor(x, y, config = {}) {
        this.x = Number.isFinite(x) ? x : 0;
        this.y = Number.isFinite(y) ? y : 0;

        // size — только визуальный размер. Коллизия использует отдельный
        // радиус точки опоры, чтобы рендер и физика не зависели друг от друга.
        this.size = config.size ?? 0.4;
        this.collisionSize = config.collisionSize ?? Math.min(this.size, 0.22);
        this.speed = config.speed ?? 0.06;
        this.direction = 'down';
        this.isMoving = false;

        this._maxStep = config.maxStep ?? 0.2;
        this._collisionStep = config.collisionStep ?? 0.05;
        this._epsilon = 1e-9;
    }

    move(dx, dy, deltaTime, map, speedMultiplier = 1) {
        const dt = Number.isFinite(deltaTime) && deltaTime > 0
            ? Math.min(deltaTime, 0.05)
            : 0.016;

        if (!dx && !dy) {
            this.isMoving = false;
            return;
        }

        this.isMoving = true;

        // Любое направление сначала нормализуется. Поэтому диагональ не
        // получает преимущества по скорости.
        const length = Math.hypot(dx, dy) || 1;
        dx /= length;
        dy /= length;

        const distance = Math.min(
            this.speed * dt * 60 * Math.max(0, Number(speedMultiplier) || 1),
            this._maxStep
        );

        const steps = Math.max(1, Math.ceil(distance / this._collisionStep));
        const stepX = dx * distance / steps;
        const stepY = dy * distance / steps;

        for (let i = 0; i < steps; i++) {
            const nextX = this.x + stepX;
            const nextY = this.y + stepY;

            // КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ:
            // Сначала проверяем целую диагональную позицию X+Y. Раньше X и Y
            // проверялись по очереди, что давало разные границы для X+Y- и X-Y+
            // на изометрической карте.
            const wallBlocked = typeof map.isWallBlockedBetween === 'function'
                && map.isWallBlockedBetween(this.x, this.y, nextX, nextY, this.collisionSize / 2);
            if (!wallBlocked && !this._isColliding(nextX, nextY, map)) {
                this.x = nextX;
                this.y = nextY;
                continue;
            }

            // Если диагональ упёрлась в препятствие, разрешаем естественное
            // скольжение вдоль свободной границы, но только после полной
            // проверки целевой позиции.
            const canMoveX = stepX !== 0 && !this._isColliding(nextX, this.y, map);
            const canMoveY = stepY !== 0 && !this._isColliding(this.x, nextY, map);

            if (canMoveX && !canMoveY) {
                this.x = nextX;
            } else if (canMoveY && !canMoveX) {
                this.y = nextY;
            } else if (canMoveX && canMoveY) {
                // При одновременной возможности сохраняем направление с большим
                // модулем. Для равных диагоналей это не даёт скрытого приоритета
                // верхней/нижней стороне тайла.
                if (Math.abs(stepX) > Math.abs(stepY) + this._epsilon) this.x = nextX;
                else if (Math.abs(stepY) > Math.abs(stepX) + this._epsilon) this.y = nextY;
            }
        }

        this._updateDirection(dx, dy);
    }

    _tileCoord(value) {
        // В этой карте целочисленные координаты (0,0), (1,0), ... — это ЦЕНТРЫ
        // ромбов, потому что именно так Map.getVisibleTiles() передаёт их в
        // worldToScreen(). Поэтому floor(value) был асимметричен: справа граница
        // получалась около +1 от центра, слева — около 0. Правильная граница
        // между центрами находится на ±0.5, значит нужен nearest-cell.
        return Math.floor(value + 0.5);
    }

    _isColliding(x, y, map) {
        if (!map || typeof map.getTile !== 'function' || !Number.isFinite(x) || !Number.isFinite(y)) {
            return true;
        }

        // Коллизия — компактный круг вокруг точки ног. Проверяем центр и 8
        // направлений, поэтому верх/низ и обе диагонали имеют одинаковую физику.
        const r = Math.max(0, this.collisionSize / 2);
        const d = r * Math.SQRT1_2;
        const samples = r <= this._epsilon
            ? [[x, y]]
            : [
                [x, y],
                [x - r, y], [x + r, y],
                [x, y - r], [x, y + r],
                [x - d, y - d], [x + d, y - d],
                [x - d, y + d], [x + d, y + d],
            ];

        for (const [sx, sy] of samples) {
            const tx = this._tileCoord(sx);
            const ty = this._tileCoord(sy);
            const tile = map.getTile(tx, ty);
            if (!tile || tile.walkable !== true) return true;
        }

        // Объекты — отдельный слой коллизий. Теперь дерево, палатка или
        // оборудование завода может блокировать игрока, не превращая землю
        // под собой в "стену" и не ломая систему биомов.
        if (typeof map.isObjectBlocked === 'function' && map.isObjectBlocked(x, y, r)) return true;

        return false;
    }

    _updateDirection(dx, dy) {
        if (dx !== 0 && dy !== 0) {
            if (dx > 0 && dy < 0) this.direction = 'up-right';
            else if (dx > 0 && dy > 0) this.direction = 'down-right';
            else if (dx < 0 && dy < 0) this.direction = 'up-left';
            else this.direction = 'down-left';
        } else if (dx !== 0) {
            this.direction = dx > 0 ? 'right' : 'left';
        } else if (dy !== 0) {
            this.direction = dy > 0 ? 'down' : 'up';
        }
    }

    clearCache() {}
    getSize() { return this.size; }
}
