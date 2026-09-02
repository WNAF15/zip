export class Camera {
    constructor(player) {
        this.player = player;
        this.angle = 0;
        this.targetAngle = 0;
        this.allowedAngles = [0, 90, 180, 270];
        // ~0.35 секунды на поворот 90°. Значение в градусах/сек.
        this.rotationSpeed = 260;
        this.maxAngleStep = 18;
        this.rotationEpsilon = 0.01;
        // Индекс спрайтового ракурса меняется только после завершения
        // анимации, поэтому atlas не перескакивает в середине поворота.
        this.spriteRotationIndex = 0;

        this.x = player?.x ?? 0;
        this.y = player?.y ?? 0;
        this.targetX = this.x;
        this.targetY = this.y;
        this.smoothFollowSpeed = 0.15;

        this.zoom = 1;
        this.targetZoom = 1;
        this.minZoom = 0.5;
        this.maxZoom = 2.0;
        // Достаточно быстро, чтобы видимые тайлы не появлялись с задержкой.
        this.zoomSpeed = 0.18;
    }

    _normalize(angle) { return ((angle % 360) + 360) % 360; }
    _shortestDiff(from, to) { return ((to - from + 540) % 360) - 180; }

    rotate(degrees) {
        if (!Number.isFinite(degrees) || degrees === 0) return;
        // Берём уже запланированный ракурс, а не текущий промежуточный угол.
        // Это предотвращает скачки при повторном нажатии Q/E во время анимации.
        const base = this._normalize(this.targetAngle);
        const currentIndex = this.allowedAngles.indexOf(Math.round(base / 90) * 90 % 360);
        const index = currentIndex >= 0 ? currentIndex : 0;
        const step = degrees > 0 ? 1 : -1;
        this.targetAngle = this.allowedAngles[(index + step + this.allowedAngles.length) % this.allowedAngles.length];
    }

    isRotating() { return Math.abs(this._shortestDiff(this.angle, this.targetAngle)) > this.rotationEpsilon; }
    getSpriteRotationIndex() { return this.spriteRotationIndex; }

    zoomIn() { this.targetZoom = Math.min(this.maxZoom, this.targetZoom + 0.1); }
    zoomOut() { this.targetZoom = Math.max(this.minZoom, this.targetZoom - 0.1); }
    resetZoom() { this.targetZoom = 1; }
    setZoom(value) { this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, value)); }

    snapToPlayer() {
        this.x = this.targetX = this.player?.x ?? 0;
        this.y = this.targetY = this.player?.y ?? 0;
    }

    update(deltaTime) {
        const dt = Number.isFinite(deltaTime) ? Math.min(Math.max(deltaTime, 0), 0.05) : 0.016;
        this.targetX = this.player?.x ?? this.targetX;
        this.targetY = this.player?.y ?? this.targetY;
        const follow = 1 - Math.exp(-this.smoothFollowSpeed * 60 * dt);
        this.x += (this.targetX - this.x) * follow;
        this.y += (this.targetY - this.y) * follow;

        const diff = this._shortestDiff(this.angle, this.targetAngle);
        if (Math.abs(diff) > this.rotationEpsilon) {
            const maxStep = Math.min(this.maxAngleStep, this.rotationSpeed * dt);
            const step = Math.sign(diff) * Math.min(Math.abs(diff), maxStep);
            this.angle = this._normalize(this.angle + step);
        }
        if (Math.abs(this._shortestDiff(this.angle, this.targetAngle)) <= this.rotationEpsilon) {
            this.angle = this._normalize(this.targetAngle);
            this.spriteRotationIndex = Math.round(this.angle / 90) % 4;
        }

        const z = this.targetZoom - this.zoom;
        this.zoom += z * (1 - Math.exp(-this.zoomSpeed * 60 * dt));
        if (Math.abs(z) < 0.001) this.zoom = this.targetZoom;
    }

    getRoundedAngle() { return Math.round(this.angle / 90) * 90; }
    getZoom() { return this.zoom; }
    reset() { this.angle = this.targetAngle = 0; this.spriteRotationIndex = 0; this.snapToPlayer(); this.zoom = this.targetZoom = 1; }
}
