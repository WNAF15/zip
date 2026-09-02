// modules/combat/BattleUnit.js
// ============================================================
// ЮНИТ БОЯ. Строится либо из класса игрока (GameContent.CLASSES),
// либо из шаблона врага. Характеристики S.P.E.C.I.A.L. напрямую
// влияют на бой (п.2.3 плана: "характеристики... влияют не только
// на бой").
// ============================================================

let _uidCounter = 0;

export class BattleUnit {
    constructor(config) {
        this.id = config.id || `unit_${++_uidCounter}`;
        this.name = config.name || 'Существо';
        this.isPlayer = !!config.isPlayer;
        this.isPet = !!config.isPet;
        this.classId = config.classId || null;
        this.quirk = config.quirk || null; // { id, kind, name, desc }

        const special = config.special || {
            strength: 5, perception: 5, endurance: 5, charisma: 5, intelligence: 5, agility: 5, luck: 5,
        };
        this.special = special;

        // === Производные боевые характеристики ===
        this.maxHp = config.maxHp ?? (20 + special.endurance * 6);
        this.hp = this.maxHp;
        this.maxStamina = config.maxStamina ?? (5 + Math.floor(special.endurance / 2));
        this.stamina = this.maxStamina;
        this.attack = config.attack ?? (3 + special.strength * 2);
        this.defense = config.defense ?? Math.floor(special.endurance * 0.8);
        this.speed = config.speed ?? (special.agility + Math.floor(special.luck / 3)); // инициатива
        this.moveRange = config.moveRange ?? (2 + Math.floor(special.agility / 3));
        this.attackRange = config.attackRange ?? 1;
        this.critChance = config.critChance ?? Math.min(0.4, special.luck * 0.02);

        // === Позиция на сетке ===
        this.gridX = config.gridX ?? 0;
        this.gridY = config.gridY ?? 0;
        // Визуальная (плавно анимируемая) позиция — отдельно от логической,
        // чтобы перемещение по клеткам не дёргалось (п.2 ТЗ "без рывков").
        this.visualX = this.gridX;
        this.visualY = this.gridY;

        // === Ресурсы хода ===
        this.moveUsed = false;
        this.actionUsed = false;
        this.skillCharges = config.skillCharges ?? 1; // "разовые" фишки классов на бой

        this.alive = true;
        this.statusEffects = []; // {id, turnsLeft, ...}
        this.comboCount = 0;     // для "Бешеный комбо" (быстрые нажатия)
    }

    resetTurnResources() {
        this.moveUsed = false;
        this.actionUsed = false;
    }

    canAct() {
        return this.alive && (!this.moveUsed || !this.actionUsed);
    }

    takeDamage(amount) {
        this.hp = Math.max(0, this.hp - Math.max(0, amount));
        if (this.hp <= 0) this.alive = false;
        return this.hp;
    }

    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
        return this.hp;
    }
}

// === Фабрика юнита-игрока из класса плана (GameContent.CLASSES) ===
export function createPlayerUnit(classDef, gridX, gridY) {
    return new BattleUnit({
        id: 'player',
        name: classDef.name,
        isPlayer: true,
        classId: classDef.id,
        quirk: classDef.combatQuirk,
        special: classDef.special,
        gridX, gridY,
        attackRange: (classDef.id === 'tempter' || classDef.id === 'strategist') ? 2 : 1,
    });
}

// === Простые шаблоны врагов для 1 круга (низшие бесы-рабы) ===
export const ENEMY_TEMPLATES = {
    imp_slave: {
        name: 'Бес-раб',
        special: { strength: 4, perception: 3, endurance: 4, charisma: 1, intelligence: 2, agility: 4, luck: 2 },
        maxHp: 26, attack: 6, defense: 2, moveRange: 3, attackRange: 1,
    },
    overseer: {
        name: 'Надсмотрщик',
        special: { strength: 6, perception: 4, endurance: 6, charisma: 3, intelligence: 3, agility: 3, luck: 2 },
        maxHp: 42, attack: 9, defense: 4, moveRange: 2, attackRange: 1,
    },
    boss_warden: {
        name: 'Страж рудника (босс)',
        special: { strength: 9, perception: 5, endurance: 9, charisma: 4, intelligence: 4, agility: 4, luck: 3 },
        maxHp: 120, attack: 14, defense: 6, moveRange: 3, attackRange: 2,
    },
};

export function createEnemyUnit(templateId, gridX, gridY, idx = 0) {
    const tpl = ENEMY_TEMPLATES[templateId] || ENEMY_TEMPLATES.imp_slave;
    return new BattleUnit({
        id: `enemy_${templateId}_${idx}`,
        name: tpl.name,
        isPlayer: false,
        special: tpl.special,
        maxHp: tpl.maxHp,
        attack: tpl.attack,
        defense: tpl.defense,
        moveRange: tpl.moveRange,
        attackRange: tpl.attackRange,
        gridX, gridY,
    });
}
