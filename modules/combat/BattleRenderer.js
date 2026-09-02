// modules/combat/BattleRenderer.js
// ============================================================
// ОТРИСОВКА БОЯ ПОВЕРХ ЭКРАНА ИГРЫ (п.6 плана: "боёвка должна
// высвечиваться поверх экрана игры, чтобы не создавать несколько
// окон, которые будут нагружать сервер").
//
// Реализовано отдельным DOM-слоем (div + canvas) внутри того же
// #game-container — это НЕ новое окно/вкладка, а оверлей, поэтому
// сервер и так ничего не грузит: вся боевая логика (BattleManager)
// уже работает только на клиенте.
//
// Плавность (п.2 ТЗ): визуальные позиции юнитов (visualX/visualY)
// лерпятся к логическим (gridX/gridY) каждый кадр с dt, зажатым
// как и в основном игровом цикле — это убирает рывки при просадках
// FPS.
// ============================================================

const CELL_COLOR_EMPTY = '#241512';
const CELL_COLOR_GRID = 'rgba(255,255,255,0.06)';
const CELL_COLOR_VALID = 'rgba(255, 107, 53, 0.35)';
const CELL_COLOR_VALID_BORDER = '#FF6B35';

export class BattleRenderer {
    constructor(container, battleManager) {
        this.container = container;
        this.battle = battleManager;

        this.root = document.createElement('div');
        this.root.className = 'battle-overlay';
        this.root.style.cssText = `
            position: absolute; inset: 0; z-index: 2000;
            display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
            background: radial-gradient(ellipse at center, rgba(40,10,10,0.55), rgba(10,4,4,0.85));
            backdrop-filter: blur(1px);
        `;

        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = `
            display: block; margin: 12px auto; image-rendering: pixelated;
            box-shadow: 0 0 40px rgba(255,107,53,0.25); border-radius: 10px;
        `;
        this.ctx = this.canvas.getContext('2d');

        this.logBox = document.createElement('div');
        this.logBox.style.cssText = `
            position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
            color: #f0d9c8; font-family: monospace; font-size: 13px; text-align: center;
            background: rgba(0,0,0,0.5); padding: 6px 16px; border-radius: 8px; max-width: 80%;
        `;

        this.actionBar = document.createElement('div');
        this.actionBar.style.cssText = `
            display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; justify-content: center;
        `;

        this.root.appendChild(this.logBox);
        this.root.appendChild(this.canvas);
        this.root.appendChild(this.actionBar);
        this.container.appendChild(this.root);

        this.cellSize = 44;
        this._resize();

        this._boundClick = this._onCanvasClick.bind(this);
        this.canvas.addEventListener('click', this._boundClick);

        this._resizeHandler = () => this._resize();
        window.addEventListener('resize', this._resizeHandler);

        this._destroyed = false;
        this.renderActionBar();
    }

    _resize() {
        const size = this.battle.gridSize;
        const maxCell = Math.floor(Math.min(window.innerWidth * 0.7, window.innerHeight * 0.55) / size);
        this.cellSize = Math.max(24, Math.min(48, maxCell));
        this.canvas.width = Math.ceil(size * this.cellSize);
        this.canvas.height = Math.ceil(size * this.cellSize * 0.65);
    }

    // === Обновление плавной анимации (вызывается каждый кадр из Game) ===
    update(dt) {
        const lerpSpeed = Math.min(1, dt * 10); // ~плавное сближение за ~0.1с
        for (const unit of this.battle.allUnits) {
            unit.visualX += (unit.gridX - unit.visualX) * lerpSpeed;
            unit.visualY += (unit.gridY - unit.visualY) * lerpSpeed;
            if (Math.abs(unit.gridX - unit.visualX) < 0.01) unit.visualX = unit.gridX;
            if (Math.abs(unit.gridY - unit.visualY) < 0.01) unit.visualY = unit.gridY;
        }
    }

    render() {
        const ctx=this.ctx, cs=this.cellSize, size=this.battle.gridSize;
        ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
        ctx.fillStyle='#120b0a';ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
        const ox=this.canvas.width/2, oy=cs*0.75;
        const iso=(x,y)=>({x:ox+(x-y)*cs*.5,y:oy+(x+y)*cs*.25});
        // Изометрическое поле — визуально ближе к основной карте.
        for(let y=0;y<size;y++)for(let x=0;x<size;x++){
            const p=iso(x,y), valid=this.battle.validCells.some(c=>c.x===x&&c.y===y);
            ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+cs*.5,p.y+cs*.25);ctx.lineTo(p.x,p.y+cs*.5);ctx.lineTo(p.x-cs*.5,p.y+cs*.25);ctx.closePath();
            ctx.fillStyle=valid?'rgba(255,107,53,.32)':'#2a1915';ctx.fill();ctx.strokeStyle=valid?'#FF6B35':'rgba(255,255,255,.10)';ctx.stroke();
        }
        for(const unit of this.battle.allUnits){if(unit.alive||unit.hp<=0)this._drawUnit(unit,iso(unit.visualX,unit.visualY));}
        this._updateLog();this.renderActionBar();
    }

    _drawUnit(unit, pos) {
        const ctx = this.ctx;
        const cs = this.cellSize;
        const px = pos.x;
        const py = pos.y + cs * 0.25;
        const r = cs * 0.32;

        const isActive = this.battle.activeUnit === unit && unit.alive;

        if (!unit.alive) ctx.globalAlpha = 0.25;

        // тело
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = unit.isPlayer ? '#4FC3F7' : (unit.isPet ? '#81C784' : '#E57373');
        ctx.fill();
        ctx.lineWidth = isActive ? 3 : 1.5;
        ctx.strokeStyle = isActive ? '#FFD166' : 'rgba(255,255,255,0.6)';
        ctx.stroke();

        // HP-бар
        const barW = cs * 0.7;
        const barH = 4;
        const bx = px - barW / 2;
        const by = py - r - 10;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(bx, by, barW, barH);
        const hpRatio = Math.max(0, unit.hp / unit.maxHp);
        ctx.fillStyle = hpRatio > 0.5 ? '#81C784' : hpRatio > 0.25 ? '#FFB74D' : '#E57373';
        ctx.fillRect(bx, by, barW * hpRatio, barH);

        ctx.globalAlpha = 1;

        // имя
        ctx.fillStyle = '#f0d9c8';
        ctx.font = `${Math.round(cs * 0.22)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(unit.name, px, py + r + 12);
    }

    _updateLog() {
        this.logBox.textContent = this.battle.lastLog.slice(-2).join('  •  ');
    }

    renderActionBar() {
        this.actionBar.innerHTML = '';
        const battle = this.battle;
        if (!battle.activeUnit || !battle.activeUnit.isPlayer) return;

        if (battle.phase === 'action_select') {
            for (const action of battle.getAvailableActions()) {
                this.actionBar.appendChild(this._makeButton(action.name, () => {
                    battle.selectAction(action.id);
                    this.render();
                }));
            }
        } else if (battle.phase === 'target_select') {
            this.actionBar.appendChild(this._makeButton('Отмена', () => {
                battle.cancelTargetSelect();
                this.render();
            }, true));
        }
    }

    _makeButton(label, onClick, secondary = false) {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.style.cssText = `
            padding: 8px 16px; border-radius: 8px; cursor: pointer;
            font-family: monospace; font-size: 13px;
            background: ${secondary ? 'rgba(255,255,255,0.15)' : '#FF6B35'};
            color: white; border: none;
        `;
        btn.addEventListener('click', onClick);
        return btn;
    }

    _onCanvasClick(e) {
        if (this.battle.phase !== 'target_select') return;
        const rect=this.canvas.getBoundingClientRect(),cs=this.cellSize;
        const px=(e.clientX-rect.left)*this.canvas.width/rect.width-this.canvas.width/2;
        const py=(e.clientY-rect.top)*this.canvas.height/rect.height-cs*.75;
        const x=Math.floor(py/(cs*.5)+px/cs+0.5), y=Math.floor(py/(cs*.5)-px/cs+0.5);
        if(x<0||y<0||x>=this.battle.gridSize||y>=this.battle.gridSize)return;
        this.battle.selectTarget(x,y);
        this.render();
    }

    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;
        this.canvas.removeEventListener('click', this._boundClick);
        window.removeEventListener('resize', this._resizeHandler);
        if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
    }
}
