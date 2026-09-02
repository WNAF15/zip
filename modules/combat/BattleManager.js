// modules/combat/BattleManager.js
// ============================================================
// ЯДРО БОЕВОЙ СИСТЕМЫ (п.2.2 и п.6 ТЗ)
//
// Порядок хода строго в три фазы, как просили:
//   1. ACTION_SELECT  — выбор действия (ход / удар / навык / поимка / конец хода)
//   2. TARGET_SELECT  — выбор клетки, на которую действие будет применено
//   3. RESOLVING      — само действие выполняется (плавная анимация)
// Затем либо снова ACTION_SELECT (если остались ресурсы хода —
// "один раз походить, один раз ударить", п.6 плана), либо ход
// переходит следующему юниту по инициативе (скорость/агильность).
//
// Враги проходят ТЕ ЖЕ фазы через ИИ (простую эвристику), а не
// отдельный код — это даёт единый, предсказуемый и симметричный
// бой, как в Mewgenics.
//
// Вся логика — только на клиенте (как и требует план: "все данные
// боя будут лишь на компьютере игрока"); наружу торчит лишь
// getBattleResult() с итогом для сохранения после боя.
// ============================================================

import { BattleGrid } from './BattleGrid.js';

export const BattlePhase = {
    INTRO: 'intro',
    ACTION_SELECT: 'action_select',
    TARGET_SELECT: 'target_select',
    RESOLVING: 'resolving',
    VICTORY: 'victory',
    DEFEAT: 'defeat',
};

function log(message, type = 'info') {
    const styles = {
        info: 'color: #FF6B35; font-weight: bold;',
        success: 'color: #81C784; font-weight: bold;',
        warning: 'color: #FFB74D; font-weight: bold;',
    };
    console.log(`%c⚔️ [Battle] ${message}`, styles[type] || styles.info);
}

export class BattleManager {
    /**
     * @param {BattleUnit[]} playerUnits
     * @param {BattleUnit[]} enemyUnits
     * @param {Object} opts { isBoss, onEnd(result), onPhaseChange(phase) }
     */
    constructor(playerUnits, enemyUnits, opts = {}) {
        this.gridSize = opts.isBoss ? 15 : 10;
        this.grid = new BattleGrid(this.gridSize);

        this.playerUnits = playerUnits;
        this.enemyUnits = enemyUnits;
        this.allUnits = [...playerUnits, ...enemyUnits];

        for (const u of this.allUnits) {
            this.grid.setOccupant(u.gridX, u.gridY, u.id);
        }

        // Инициатива: сортировка по speed (агильность+удача) — как в Mewgenics
        this.initiativeOrder = [...this.allUnits].sort((a, b) => b.speed - a.speed);
        this.turnIndex = -1;
        this.round = 1;

        this.phase = BattlePhase.INTRO;
        this.activeUnit = null;
        this.pendingAction = null;   // { id, kind, validCells }
        this.validCells = [];
        this.lastLog = [];

        this._onEnd = opts.onEnd || (() => {});
        this._onPhaseChange = opts.onPhaseChange || (() => {});
        this._onAnimation = opts.onAnimation || (() => {});

        this.capturedPets = [];      // п.6.1: пойманные существа
        this._animating = false;
        this._aiTimer = null;
        this._destroyed = false;

        this._pushLog('Бой начался!');
        this._nextTurn();
    }

    _setPhase(phase) {
        this.phase = phase;
        this._onPhaseChange(phase, this.activeUnit);
    }

    _pushLog(text) {
        this.lastLog.push(text);
        if (this.lastLog.length > 6) this.lastLog.shift();
    }

    // ============================================================
    // ОЧЕРЁДНОСТЬ ХОДОВ
    // ============================================================
    _nextTurn() {
        if (this._destroyed) return;

        const winner = this._checkWinner();
        if (winner) { this._finish(winner); return; }

        let attempts = 0;
        do {
            this.turnIndex = (this.turnIndex + 1) % this.initiativeOrder.length;
            if (this.turnIndex === 0) {
                this.round++;
                this._onRoundStart();
            }
            attempts++;
        } while (!this.initiativeOrder[this.turnIndex].alive && attempts <= this.initiativeOrder.length);

        this.activeUnit = this.initiativeOrder[this.turnIndex];
        if (!this.activeUnit.alive) { this._finish(this._checkWinner() || 'draw'); return; }

        this.activeUnit.resetTurnResources();
        this._pushLog(`Ход: ${this.activeUnit.name}`);
        this._setPhase(BattlePhase.ACTION_SELECT);

        if (!this.activeUnit.isPlayer) {
            this._aiTimer = setTimeout(() => this._runAiTurn(), 450);
        }
    }

    _onRoundStart() {
        // Регенерация "Отращивание" (демон-зарождатель, п.2.5 / фишка боя)
        for (const u of this.allUnits) {
            if (!u.alive) continue;
            if (u.quirk?.kind === 'regen_and_clone') {
                u.heal(Math.round(u.maxHp * 0.06));
            }
        }
    }

    _checkWinner() {
        const playersAlive = this.playerUnits.some((u) => u.alive);
        const enemiesAlive = this.enemyUnits.some((u) => u.alive);
        if (!playersAlive) return 'enemy';
        if (!enemiesAlive) return 'player';
        return null;
    }

    _finish(winner) {
        this._setPhase(winner === 'player' ? BattlePhase.VICTORY : BattlePhase.DEFEAT);
        this._pushLog(winner === 'player' ? 'Победа!' : 'Поражение...');
        clearTimeout(this._aiTimer);
        this._onEnd(this.getBattleResult(winner));
    }

    getBattleResult(winner) {
        return {
            winner,
            round: this.round,
            capturedPets: this.capturedPets.map((p) => ({ id: p.id, name: p.name })),
            survivingPlayers: this.playerUnits.filter((u) => u.alive).map((u) => u.id),
        };
    }

    // ============================================================
    // ФАЗА 1: ВЫБОР ДЕЙСТВИЯ
    // ============================================================
    getAvailableActions(unit = this.activeUnit) {
        const actions = [];
        if (!unit.moveUsed) actions.push({ id: 'move', name: 'Движение' });
        if (!unit.actionUsed) {
            actions.push({ id: 'attack', name: 'Атака' });
            if (unit.quirk && unit.skillCharges > 0) {
                actions.push({ id: 'skill', name: unit.quirk.name || 'Навык' });
            }
            if (unit.isPlayer) {
                const target = this._findAdjacentLowHpEnemy(unit);
                if (target) actions.push({ id: 'capture', name: 'Поймать (питомец)' });
            }
        }
        actions.push({ id: 'end_turn', name: 'Закончить ход' });
        return actions;
    }

    selectAction(actionId) {
        if (this.phase !== BattlePhase.ACTION_SELECT) return false;
        const unit = this.activeUnit;
        const available = this.getAvailableActions(unit).map((a) => a.id);
        if (!available.includes(actionId)) return false;

        if (actionId === 'end_turn') {
            this._endActiveUnitTurn();
            return true;
        }

        let validCells = [];
        let kind = actionId;

        if (actionId === 'move') {
            validCells = this.grid.getReachableCells(unit.gridX, unit.gridY, unit.moveRange);
        } else if (actionId === 'attack') {
            validCells = this._enemyCellsInRange(unit, unit.attackRange);
        } else if (actionId === 'capture') {
            validCells = this._enemyCellsInRange(unit, 1, true);
        } else if (actionId === 'skill') {
            const quirkKind = unit.quirk?.kind;
            if (quirkKind === 'foresight' || quirkKind === 'regen_and_clone') {
                // Эти навыки не требуют выбора клетки — применяются сразу
                this.pendingAction = { id: 'skill', kind: quirkKind };
                this._setPhase(BattlePhase.TARGET_SELECT);
                this.selectTarget(unit.gridX, unit.gridY);
                return true;
            }
            if (quirkKind === 'suggestion') {
                validCells = this._enemyCellsInRange(unit, 3);
            } else if (quirkKind === 'haggle' || quirkKind === 'frenzy_combo') {
                validCells = this._enemyCellsInRange(unit, unit.attackRange);
            }
        }

        if (validCells.length === 0) {
            // Нет доступных клеток для этого действия — остаёмся в выборе действия
            return false;
        }

        this.pendingAction = { id: actionId, kind };
        this.validCells = validCells;
        this._setPhase(BattlePhase.TARGET_SELECT);
        return true;
    }

    cancelTargetSelect() {
        if (this.phase !== BattlePhase.TARGET_SELECT) return;
        this.pendingAction = null;
        this.validCells = [];
        this._setPhase(BattlePhase.ACTION_SELECT);
    }

    // ============================================================
    // ФАЗА 2 -> 3: ВЫБОР КЛЕТКИ И ВЫПОЛНЕНИЕ
    // ============================================================
    selectTarget(x, y) {
        if (this.phase !== BattlePhase.TARGET_SELECT) return false;
        const isValid = this.pendingAction.id === 'skill' && (this.pendingAction.kind === 'foresight' || this.pendingAction.kind === 'regen_and_clone')
            ? true
            : this.validCells.some((c) => c.x === x && c.y === y);
        if (!isValid) return false;

        this._setPhase(BattlePhase.RESOLVING);
        this._resolveAction(this.pendingAction, x, y);
        return true;
    }

    _resolveAction(action, x, y) {
        const unit = this.activeUnit;

        switch (action.id) {
            case 'move': {
                const path = this.grid.getPath(unit.gridX, unit.gridY, x, y, unit.moveRange) || [{ x, y }];
                this.grid.clearOccupant(unit.gridX, unit.gridY);
                unit.gridX = x; unit.gridY = y;
                this.grid.setOccupant(x, y, unit.id);
                unit.moveUsed = true;
                this._onAnimation({ type: 'move', unitId: unit.id, path });
                this._pushLog(`${unit.name} перемещается.`);
                break;
            }
            case 'attack': {
                const targetId = this.grid.getOccupant(x, y);
                const target = this.allUnits.find((u) => u.id === targetId);
                this._performAttack(unit, target, { animType: 'attack' });
                unit.actionUsed = true;
                break;
            }
            case 'capture': {
                const targetId = this.grid.getOccupant(x, y);
                const target = this.allUnits.find((u) => u.id === targetId);
                if (target && target.hp <= target.maxHp * 0.25) {
                    target.alive = false;
                    this.grid.clearOccupant(target.gridX, target.gridY);
                    this.capturedPets.push(target);
                    this._pushLog(`${unit.name} ловит ${target.name} как питомца!`);
                    this._onAnimation({ type: 'capture', unitId: unit.id, targetId: target.id });
                }
                unit.actionUsed = true;
                break;
            }
            case 'skill': {
                this._resolveSkill(unit, action.kind, x, y);
                unit.actionUsed = true;
                unit.skillCharges = Math.max(0, unit.skillCharges - 1);
                break;
            }
            default:
                break;
        }

        // "плавно, без рывков" — даём анимации время, дальше решает рендерер/оболочка,
        // здесь же логика сразу консистентна (данные обновлены), визуал доедет плавно.
        this.pendingAction = null;
        this.validCells = [];

        const winner = this._checkWinner();
        if (winner) { this._finish(winner); return; }

        if (unit.canAct()) {
            this._setPhase(BattlePhase.ACTION_SELECT);
            if (!unit.isPlayer) this._aiTimer = setTimeout(() => this._runAiTurn(), 400);
        } else {
            this._endActiveUnitTurn();
        }
    }

    _performAttack(attacker, target, meta = {}) {
        if (!target) return;
        let damage = Math.max(1, attacker.attack - target.defense);

        // Фишка "Бешеный комбо" — серия попаданий увеличивает урон (реакция игрока)
        if (attacker.quirk?.kind === 'frenzy_combo') {
            attacker.comboCount = (attacker.comboCount || 0) + 1;
            damage = Math.round(damage * (1 + Math.min(attacker.comboCount * 0.15, 0.6)));
        } else {
            attacker.comboCount = 0;
        }

        const isCrit = Math.random() < attacker.critChance;
        if (isCrit) damage = Math.round(damage * 1.6);

        target.takeDamage(damage);
        this._pushLog(`${attacker.name} бьёт ${target.name} на ${damage}${isCrit ? ' (крит!)' : ''}.`);
        this._onAnimation({ type: meta.animType || 'attack', unitId: attacker.id, targetId: target.id, damage, isCrit });

        if (!target.alive) {
            this.grid.clearOccupant(target.gridX, target.gridY);
            this._pushLog(`${target.name} повержен.`);
        }
    }

    _resolveSkill(unit, kind, x, y) {
        if (kind === 'suggestion') {
            const targetId = this.grid.getOccupant(x, y);
            const target = this.allUnits.find((u) => u.id === targetId);
            if (target) {
                target.statusEffects.push({ id: 'suggested', turnsLeft: 1 });
                this._pushLog(`${unit.name} внушает мысль существу ${target.name}.`);
                this._onAnimation({ type: 'skill', unitId: unit.id, targetId: target.id, quirk: kind });
            }
        } else if (kind === 'haggle') {
            const targetId = this.grid.getOccupant(x, y);
            const target = this.allUnits.find((u) => u.id === targetId);
            if (target) {
                this._performAttack(unit, target, { animType: 'skill' });
                if (Math.random() < 0.5) this._pushLog(`${unit.name} попутно обчищает карманы ${target.name}.`);
            }
        } else if (kind === 'frenzy_combo') {
            const targetId = this.grid.getOccupant(x, y);
            const target = this.allUnits.find((u) => u.id === targetId);
            if (target) this._performAttack(unit, target, { animType: 'skill' });
        } else if (kind === 'foresight') {
            const enemyIntent = this._peekEnemyIntent();
            this._pushLog(`${unit.name} предвидит: ${enemyIntent}.`);
            this._onAnimation({ type: 'skill', unitId: unit.id, quirk: kind, info: enemyIntent });
        } else if (kind === 'regen_and_clone') {
            unit.heal(Math.round(unit.maxHp * 0.2));
            this._pushLog(`${unit.name} отращивает ткани и восстанавливает здоровье.`);
            this._onAnimation({ type: 'skill', unitId: unit.id, quirk: kind });
        }
    }

    _peekEnemyIntent() {
        const nextEnemy = this.initiativeOrder.find((u) => u.alive && !u.isPlayer);
        if (!nextEnemy) return 'враги неактивны';
        return `${nextEnemy.name} готовится действовать рядом с (${nextEnemy.gridX}, ${nextEnemy.gridY})`;
    }

    _endActiveUnitTurn() {
        this.pendingAction = null;
        this.validCells = [];
        clearTimeout(this._aiTimer);
        this._nextTurn();
    }

    // ============================================================
    // ИИ ВРАГА — проходит ТЕ ЖЕ фазы select action -> select target
    // ============================================================
    _runAiTurn() {
        if (this._destroyed || this.phase !== BattlePhase.ACTION_SELECT) return;
        const unit = this.activeUnit;
        if (!unit || unit.isPlayer || !unit.alive) return;

        const nearestPlayer = this._nearestAlive(unit, this.playerUnits);
        if (!nearestPlayer) { this._endActiveUnitTurn(); return; }

        const distNow = this._dist(unit, nearestPlayer);

        if (distNow <= unit.attackRange && !unit.actionUsed) {
            this.selectAction('attack');
            setTimeout(() => this.selectTarget(nearestPlayer.gridX, nearestPlayer.gridY), 300);
            return;
        }

        if (!unit.moveUsed) {
            this.selectAction('move');
            const cells = this.validCells;
            if (cells.length === 0) { this._endActiveUnitTurn(); return; }
            let best = cells[0];
            let bestDist = Infinity;
            for (const c of cells) {
                const d = Math.abs(c.x - nearestPlayer.gridX) + Math.abs(c.y - nearestPlayer.gridY);
                if (d < bestDist) { bestDist = d; best = c; }
            }
            setTimeout(() => {
                this.selectTarget(best.x, best.y);
                setTimeout(() => {
                    if (this.phase === BattlePhase.ACTION_SELECT && this.activeUnit === unit) {
                        this._runAiTurn();
                    }
                }, 350);
            }, 300);
            return;
        }

        this._endActiveUnitTurn();
    }

    _nearestAlive(unit, list) {
        let best = null, bestDist = Infinity;
        for (const u of list) {
            if (!u.alive) continue;
            const d = this._dist(unit, u);
            if (d < bestDist) { bestDist = d; best = u; }
        }
        return best;
    }

    _dist(a, b) {
        return Math.max(Math.abs(a.gridX - b.gridX), Math.abs(a.gridY - b.gridY));
    }

    _enemyCellsInRange(unit, range, lowHpOnly = false) {
        const opponents = unit.isPlayer ? this.enemyUnits : this.playerUnits;
        const cells = [];
        for (const enemy of opponents) {
            if (!enemy.alive) continue;
            if (lowHpOnly && enemy.hp > enemy.maxHp * 0.25) continue;
            const d = this._dist(unit, enemy);
            if (d <= range) cells.push({ x: enemy.gridX, y: enemy.gridY, dist: d });
        }
        return cells;
    }

    _findAdjacentLowHpEnemy(unit) {
        return this._enemyCellsInRange(unit, 1, true)[0] || null;
    }

    destroy() {
        this._destroyed = true;
        clearTimeout(this._aiTimer);
    }
}
