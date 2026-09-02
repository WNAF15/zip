// modules/combat/BattleGrid.js
// ============================================================
// СЕТКА БОЯ (п.6 плана): "бой с видом сверху по карте 10 на 10,
// во время боёв с боссами карта расширяется до 15 на 15"
// ============================================================

export class BattleGrid {
    constructor(size = 10, obstacleMap = null) {
        this.size = size;
        // cells[y][x] = { obstacle: bool, occupantId: string|null }
        this.cells = [];
        for (let y = 0; y < size; y++) {
            const row = [];
            for (let x = 0; x < size; x++) {
                const obstacle = obstacleMap ? !!obstacleMap[y]?.[x] : false;
                row.push({ obstacle, occupantId: null });
            }
            this.cells.push(row);
        }
    }

    inBounds(x, y) {
        return x >= 0 && y >= 0 && x < this.size && y < this.size;
    }

    isFree(x, y) {
        if (!this.inBounds(x, y)) return false;
        const cell = this.cells[y][x];
        return !cell.obstacle && !cell.occupantId;
    }

    setOccupant(x, y, unitId) {
        if (!this.inBounds(x, y)) return;
        this.cells[y][x].occupantId = unitId;
    }

    clearOccupant(x, y) {
        if (!this.inBounds(x, y)) return;
        this.cells[y][x].occupantId = null;
    }

    getOccupant(x, y) {
        if (!this.inBounds(x, y)) return null;
        return this.cells[y][x].occupantId;
    }

    // === BFS для клеток перемещения (учитывает препятствия и занятые клетки) ===
    getReachableCells(startX, startY, moveRange) {
        const visited = new Map();
        visited.set(`${startX},${startY}`, 0);
        const queue = [{ x: startX, y: startY, dist: 0 }];
        const result = [];

        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

        while (queue.length) {
            const cur = queue.shift();
            if (cur.dist >= moveRange) continue;

            for (const [dx, dy] of dirs) {
                const nx = cur.x + dx;
                const ny = cur.y + dy;
                if (!this.inBounds(nx, ny)) continue;
                const key = `${nx},${ny}`;
                if (visited.has(key)) continue;
                if (!this.isFree(nx, ny)) continue;

                visited.set(key, cur.dist + 1);
                result.push({ x: nx, y: ny, dist: cur.dist + 1 });
                queue.push({ x: nx, y: ny, dist: cur.dist + 1 });
            }
        }
        return result;
    }

    // === Кратчайший путь для плавной анимации перемещения ===
    getPath(startX, startY, targetX, targetY, moveRange) {
        const cameFrom = new Map();
        const visited = new Set([`${startX},${startY}`]);
        const queue = [{ x: startX, y: startY, dist: 0 }];
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        let found = false;

        while (queue.length) {
            const cur = queue.shift();
            if (cur.x === targetX && cur.y === targetY) { found = true; break; }
            if (cur.dist >= moveRange) continue;

            for (const [dx, dy] of dirs) {
                const nx = cur.x + dx;
                const ny = cur.y + dy;
                if (!this.inBounds(nx, ny)) continue;
                const key = `${nx},${ny}`;
                if (visited.has(key)) continue;
                const isTarget = nx === targetX && ny === targetY;
                if (!this.isFree(nx, ny) && !isTarget) continue;

                visited.add(key);
                cameFrom.set(key, `${cur.x},${cur.y}`);
                queue.push({ x: nx, y: ny, dist: cur.dist + 1 });
            }
        }

        if (!found) return null;

        const path = [];
        let curKey = `${targetX},${targetY}`;
        while (curKey && curKey !== `${startX},${startY}`) {
            const [x, y] = curKey.split(',').map(Number);
            path.unshift({ x, y });
            curKey = cameFrom.get(curKey);
        }
        return path;
    }

    // === Клетки в радиусе (Чебышёв — квадратом) для атак/навыков ===
    getCellsInRange(centerX, centerY, range) {
        const result = [];
        for (let y = Math.max(0, centerY - range); y <= Math.min(this.size - 1, centerY + range); y++) {
            for (let x = Math.max(0, centerX - range); x <= Math.min(this.size - 1, centerX + range); x++) {
                if (x === centerX && y === centerY) continue;
                const dist = Math.max(Math.abs(x - centerX), Math.abs(y - centerY));
                if (dist <= range) result.push({ x, y, dist });
            }
        }
        return result;
    }
}
