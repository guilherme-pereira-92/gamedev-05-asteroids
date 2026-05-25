import Phaser from "phaser";
import { COLOR_HEX, TEXT_PRESETS } from "../theme";
import { drawDiagonalScanlines, createPulsingDot, addCornerLabel } from "../ui";
import { takeScreenshot } from "../screenshot";
import { playTone, unlockAudio } from "../audio";
import { isTouchDevice } from "../input";

const SHIP_ROTATION_SPEED = 4.2;
const SHIP_THRUST = 260;
const SHIP_MAX_SPEED = 340;
const SHIP_FRICTION = 0.992;
const BULLET_SPEED = 520;
const BULLET_LIFETIME_MS = 1100;
const FIRE_COOLDOWN_MS = 230;

const ASTEROID_LARGE_RADIUS = 38;
const ASTEROID_MEDIUM_RADIUS = 22;
const ASTEROID_SMALL_RADIUS = 12;
const ASTEROID_BASE_SPEED = 60;

const SCORE_LARGE = 20;
const SCORE_MEDIUM = 50;
const SCORE_SMALL = 100;

const INITIAL_LIVES = 3;
const RESPAWN_INVULN_MS = 1800;

type AsteroidSize = "large" | "medium" | "small";

interface Asteroid {
  poly: Phaser.GameObjects.Polygon;
  vx: number;
  vy: number;
  radius: number;
  size: AsteroidSize;
}

interface Bullet {
  rect: Phaser.GameObjects.Rectangle;
  vx: number;
  vy: number;
  spawnedAt: number;
}

export class GameScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Rectangle;
  private scanlines!: Phaser.GameObjects.Graphics;

  private ship!: Phaser.GameObjects.Polygon;
  private shipVx = 0;
  private shipVy = 0;
  private shipRotation = -Math.PI / 2;
  private shipAlive = true;
  private respawnInvulnUntil = 0;

  private asteroids: Asteroid[] = [];
  private bullets: Bullet[] = [];

  private score = 0;
  private lives = INITIAL_LIVES;
  private wave = 1;
  private nextFireAt = 0;

  private scoreLabel!: Phaser.GameObjects.Text;
  private livesLabel!: Phaser.GameObjects.Text;
  private waveLabel!: Phaser.GameObjects.Text;
  private bottomLeftLabel!: Phaser.GameObjects.Text;
  private bottomRightLabel!: Phaser.GameObjects.Text;
  private dot!: { dot: Phaser.GameObjects.Arc; glow: Phaser.GameObjects.Arc };

  private particles!: Phaser.GameObjects.Particles.ParticleEmitter;

  private keys!: Record<
    "LEFT" | "RIGHT" | "UP" | "A" | "D" | "W" | "SPACE" | "ESC" | "K",
    Phaser.Input.Keyboard.Key
  >;

  private touchRotateActive = false;
  private touchRotateOrigin = { x: 0, y: 0 };
  private touchRotateCurrent = { x: 0, y: 0 };

  constructor() {
    super("game");
  }

  preload() {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 3, 3);
    g.generateTexture("particle", 3, 3);
    g.destroy();
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.bg = this.add.rectangle(W / 2, H / 2, W, H, COLOR_HEX.bg);
    this.scanlines = drawDiagonalScanlines(this, W, H, 18, 0.04);

    this.particles = this.add.particles(0, 0, "particle", {
      speed: { min: 40, max: 220 },
      lifespan: 600,
      scale: { start: 1.4, end: 0 },
      alpha: { start: 1, end: 0 },
      blendMode: "ADD",
      tint: COLOR_HEX.accent,
      emitting: false,
    });

    this.drawChrome();
    this.spawnShip();
    this.spawnWave(this.wave);

    const kb = this.input.keyboard!;
    this.keys = {
      LEFT: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      RIGHT: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      UP: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      A: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      D: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      W: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      SPACE: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      ESC: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
      K: kb.addKey(Phaser.Input.Keyboard.KeyCodes.K),
    };
    kb.on("keydown", unlockAudio);

    this.setupTouchControls();

    this.scale.on("resize", this.onResize, this);

    this.events.on("shutdown", () => {
      this.asteroids = [];
      this.bullets = [];
      this.scale.off("resize", this.onResize, this);
    });
  }

  private onResize(gameSize: Phaser.Structs.Size) {
    const W = gameSize.width;
    const H = gameSize.height;
    this.bg.setPosition(W / 2, H / 2).setSize(W, H);
    this.scanlines.destroy();
    this.scanlines = drawDiagonalScanlines(this, W, H, 18, 0.04);
    this.dot.dot.setPosition(W - 22 - 4, 22 + 6);
    this.dot.glow.setPosition(W - 22 - 4, 22 + 6);
    this.scoreLabel.setPosition(W / 2, 22);
    this.waveLabel.setPosition(W - 38, 22);
    this.livesLabel.setPosition(W - 22, 44);
    this.bottomLeftLabel.setPosition(22, H - 22);
    this.bottomRightLabel.setPosition(W - 22, H - 22);
  }

  update(time: number, delta: number) {
    const dt = Math.min(delta, 33) / 1000;

    if (Phaser.Input.Keyboard.JustDown(this.keys.K)) {
      takeScreenshot(this.game, "gamedev-05-asteroids");
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
      this.scene.start("menu");
      return;
    }

    if (this.shipAlive) {
      this.handleShipInput(time, dt);
    }
    this.updateShipMotion(dt);
    this.updateAsteroids(dt);
    this.updateBullets(time, dt);
    this.checkBulletAsteroidCollisions();
    if (this.shipAlive && time > this.respawnInvulnUntil) {
      this.checkShipAsteroidCollision(time);
    }

    if (this.asteroids.length === 0) {
      this.wave++;
      this.spawnWave(this.wave);
      this.refreshChrome();
    }

    if (this.shipAlive && time < this.respawnInvulnUntil) {
      const blink = Math.floor((this.respawnInvulnUntil - time) / 120) % 2 === 0;
      this.ship.setAlpha(blink ? 1 : 0.3);
    } else if (this.shipAlive) {
      this.ship.setAlpha(1);
    }
  }

  // ---------- ship ----------

  private spawnShip() {
    const W = this.scale.width;
    const H = this.scale.height;
    if (this.ship) this.ship.destroy();
    const points = [0, -14, -10, 11, 0, 7, 10, 11];
    this.ship = this.add.polygon(W / 2, H / 2, points, undefined, 0);
    this.ship.setStrokeStyle(2, COLOR_HEX.fg, 1);
    this.ship.setOrigin(0, 0);
    this.shipVx = 0;
    this.shipVy = 0;
    this.shipRotation = -Math.PI / 2;
    this.ship.setRotation(this.shipRotation + Math.PI / 2);
    this.shipAlive = true;
    this.respawnInvulnUntil = this.time.now + RESPAWN_INVULN_MS;
  }

  private handleShipInput(time: number, dt: number) {
    const leftDown = this.keys.LEFT.isDown || this.keys.A.isDown;
    const rightDown = this.keys.RIGHT.isDown || this.keys.D.isDown;
    const thrustDown = this.keys.UP.isDown || this.keys.W.isDown;
    const fireDown = this.keys.SPACE.isDown;

    if (leftDown && !rightDown) this.shipRotation -= SHIP_ROTATION_SPEED * dt;
    else if (rightDown && !leftDown) this.shipRotation += SHIP_ROTATION_SPEED * dt;

    if (this.touchRotateActive) {
      const dx = this.touchRotateCurrent.x - this.touchRotateOrigin.x;
      const dy = this.touchRotateCurrent.y - this.touchRotateOrigin.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 15) {
        const targetAngle = Math.atan2(dy, dx);
        const diff = Phaser.Math.Angle.Wrap(targetAngle - this.shipRotation);
        const rotStep = SHIP_ROTATION_SPEED * dt;
        if (Math.abs(diff) <= rotStep) this.shipRotation = targetAngle;
        else this.shipRotation += Math.sign(diff) * rotStep;
      }
    }

    this.ship.setRotation(this.shipRotation + Math.PI / 2);

    const thrusting = thrustDown || (this.touchRotateActive &&
      Math.hypot(
        this.touchRotateCurrent.x - this.touchRotateOrigin.x,
        this.touchRotateCurrent.y - this.touchRotateOrigin.y,
      ) > 15);
    if (thrusting) {
      this.shipVx += Math.cos(this.shipRotation) * SHIP_THRUST * dt;
      this.shipVy += Math.sin(this.shipRotation) * SHIP_THRUST * dt;
      const thrustX = this.ship.x - Math.cos(this.shipRotation) * 12;
      const thrustY = this.ship.y - Math.sin(this.shipRotation) * 12;
      this.particles.emitParticleAt(thrustX, thrustY, 1);
    }

    if (fireDown && time >= this.nextFireAt) {
      this.fireBullet(time);
    }
  }

  private updateShipMotion(dt: number) {
    if (!this.shipAlive) return;
    const frictionFactor = Math.pow(SHIP_FRICTION, dt * 60);
    this.shipVx *= frictionFactor;
    this.shipVy *= frictionFactor;
    const speed = Math.sqrt(this.shipVx * this.shipVx + this.shipVy * this.shipVy);
    if (speed > SHIP_MAX_SPEED) {
      const k = SHIP_MAX_SPEED / speed;
      this.shipVx *= k;
      this.shipVy *= k;
    }
    this.ship.x += this.shipVx * dt;
    this.ship.y += this.shipVy * dt;
    this.clampShipToBounds();
  }

  // Nave para na borda — não atravessa a tela.
  // Zera velocidade no eixo de colisão pra não "grudar" empurrando.
  private clampShipToBounds() {
    const W = this.scale.width;
    const H = this.scale.height;
    const m = 14; // margem do nariz da nave
    if (this.ship.x < m) { this.ship.x = m; if (this.shipVx < 0) this.shipVx = 0; }
    else if (this.ship.x > W - m) { this.ship.x = W - m; if (this.shipVx > 0) this.shipVx = 0; }
    if (this.ship.y < m) { this.ship.y = m; if (this.shipVy < 0) this.shipVy = 0; }
    else if (this.ship.y > H - m) { this.ship.y = H - m; if (this.shipVy > 0) this.shipVy = 0; }
  }

  // ---------- asteroids ----------

  private spawnWave(wave: number) {
    const W = this.scale.width;
    const H = this.scale.height;
    const count = 3 + wave;
    for (let i = 0; i < count; i++) {
      let x: number, y: number;
      do {
        x = Phaser.Math.Between(0, W);
        y = Phaser.Math.Between(0, H);
      } while (Math.hypot(x - this.ship.x, y - this.ship.y) < 140);
      const speedMult = 1 + (wave - 1) * 0.12;
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const speed = ASTEROID_BASE_SPEED * Phaser.Math.FloatBetween(0.7, 1.3) * speedMult;
      this.addAsteroid(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, "large");
    }
  }

  private addAsteroid(x: number, y: number, vx: number, vy: number, size: AsteroidSize) {
    const radius = size === "large" ? ASTEROID_LARGE_RADIUS
      : size === "medium" ? ASTEROID_MEDIUM_RADIUS
      : ASTEROID_SMALL_RADIUS;
    const vertices = size === "large" ? 12 : size === "medium" ? 10 : 8;
    const points = this.makeAsteroidPoints(radius, vertices);
    const poly = this.add.polygon(x, y, points, undefined, 0);
    poly.setStrokeStyle(2, COLOR_HEX.fg, 0.85);
    poly.setOrigin(0, 0);
    this.asteroids.push({ poly, vx, vy, radius, size });
  }

  private makeAsteroidPoints(radius: number, vertices: number): number[] {
    const points: number[] = [];
    for (let i = 0; i < vertices; i++) {
      const angle = (i / vertices) * Math.PI * 2;
      const r = radius * Phaser.Math.FloatBetween(0.72, 1.05);
      points.push(r * Math.cos(angle), r * Math.sin(angle));
    }
    return points;
  }

  private updateAsteroids(dt: number) {
    for (const a of this.asteroids) {
      a.poly.x += a.vx * dt;
      a.poly.y += a.vy * dt;
      a.poly.rotation += dt * (a.vx + a.vy) * 0.002;
      this.wrapPosition(a.poly);
    }
  }

  // ---------- bullets ----------

  private fireBullet(time: number) {
    const noseX = this.ship.x + Math.cos(this.shipRotation) * 14;
    const noseY = this.ship.y + Math.sin(this.shipRotation) * 14;
    const rect = this.add.rectangle(noseX, noseY, 4, 4, COLOR_HEX.accent);
    this.bullets.push({
      rect,
      vx: this.shipVx + Math.cos(this.shipRotation) * BULLET_SPEED,
      vy: this.shipVy + Math.sin(this.shipRotation) * BULLET_SPEED,
      spawnedAt: time,
    });
    this.nextFireAt = time + FIRE_COOLDOWN_MS;
    playTone(880, 50, "square", 0.07);
  }

  private updateBullets(time: number, dt: number) {
    const remaining: Bullet[] = [];
    for (const b of this.bullets) {
      const age = time - b.spawnedAt;
      if (age > BULLET_LIFETIME_MS) {
        b.rect.destroy();
        continue;
      }
      b.rect.x += b.vx * dt;
      b.rect.y += b.vy * dt;
      // Tiro some ao sair da tela (espaço infinito, não wrap).
      const W = this.scale.width;
      const H = this.scale.height;
      if (b.rect.x < -8 || b.rect.x > W + 8 || b.rect.y < -8 || b.rect.y > H + 8) {
        b.rect.destroy();
        continue;
      }
      remaining.push(b);
    }
    this.bullets = remaining;
  }

  // ---------- collisions ----------

  private checkBulletAsteroidCollisions() {
    const survivingBullets: Bullet[] = [];
    const newAsteroids: Asteroid[] = [];
    const asteroidsHit = new Set<number>();

    for (const b of this.bullets) {
      let hit = false;
      for (let i = 0; i < this.asteroids.length; i++) {
        if (asteroidsHit.has(i)) continue;
        const a = this.asteroids[i];
        const dx = b.rect.x - a.poly.x;
        const dy = b.rect.y - a.poly.y;
        if (dx * dx + dy * dy < a.radius * a.radius) {
          hit = true;
          asteroidsHit.add(i);
          this.particles.emitParticleAt(a.poly.x, a.poly.y, 14);
          this.cameras.main.shake(80, 0.003);
          if (a.size === "large") {
            this.score += SCORE_LARGE;
            this.spawnChildren(a, "medium", newAsteroids);
            playTone(440, 80, "triangle", 0.10);
          } else if (a.size === "medium") {
            this.score += SCORE_MEDIUM;
            this.spawnChildren(a, "small", newAsteroids);
            playTone(660, 70, "triangle", 0.10);
          } else {
            this.score += SCORE_SMALL;
            playTone(880, 60, "triangle", 0.10);
          }
          this.refreshChrome();
          break;
        }
      }
      if (hit) b.rect.destroy();
      else survivingBullets.push(b);
    }
    this.bullets = survivingBullets;
    const remainingAsteroids: Asteroid[] = [];
    for (let i = 0; i < this.asteroids.length; i++) {
      if (asteroidsHit.has(i)) this.asteroids[i].poly.destroy();
      else remainingAsteroids.push(this.asteroids[i]);
    }
    this.asteroids = remainingAsteroids.concat(newAsteroids);
  }

  private spawnChildren(parent: Asteroid, childSize: AsteroidSize, into: Asteroid[]) {
    for (let i = 0; i < 2; i++) {
      const baseAngle = Math.atan2(parent.vy, parent.vx);
      const angle = baseAngle + Phaser.Math.FloatBetween(-Math.PI / 2.5, Math.PI / 2.5);
      const baseSpeed = Math.hypot(parent.vx, parent.vy);
      const speed = baseSpeed * Phaser.Math.FloatBetween(1.05, 1.3);
      const childRadius = childSize === "medium" ? ASTEROID_MEDIUM_RADIUS : ASTEROID_SMALL_RADIUS;
      const vertices = childSize === "medium" ? 10 : 8;
      const points = this.makeAsteroidPoints(childRadius, vertices);
      const poly = this.add.polygon(parent.poly.x, parent.poly.y, points, undefined, 0);
      poly.setStrokeStyle(2, COLOR_HEX.fg, 0.85);
      poly.setOrigin(0, 0);
      into.push({ poly, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: childRadius, size: childSize });
    }
  }

  private checkShipAsteroidCollision(time: number) {
    const shipRadius = 10;
    for (const a of this.asteroids) {
      const dx = this.ship.x - a.poly.x;
      const dy = this.ship.y - a.poly.y;
      if (dx * dx + dy * dy < (shipRadius + a.radius - 2) * (shipRadius + a.radius - 2)) {
        this.destroyShip(time);
        return;
      }
    }
  }

  private destroyShip(_time: number) {
    this.shipAlive = false;
    this.particles.emitParticleAt(this.ship.x, this.ship.y, 40);
    this.cameras.main.shake(300, 0.012);
    playTone(180, 350, "sawtooth", 0.18);
    this.ship.setVisible(false);
    this.lives--;
    this.refreshChrome();
    if (this.lives <= 0) {
      this.time.delayedCall(900, () => {
        this.scene.start("gameover", { score: this.score, wave: this.wave });
      });
    } else {
      this.time.delayedCall(900, () => {
        this.spawnShip();
        this.ship.setVisible(true);
      });
    }
  }

  // ---------- helpers ----------

  private wrapPosition(obj: Phaser.GameObjects.GameObject & { x: number; y: number }) {
    const W = this.scale.width;
    const H = this.scale.height;
    if (obj.x < -20) obj.x = W + 20;
    else if (obj.x > W + 20) obj.x = -20;
    if (obj.y < -20) obj.y = H + 20;
    else if (obj.y > H + 20) obj.y = -20;
  }

  private drawChrome() {
    const W = this.scale.width;
    const H = this.scale.height;
    addCornerLabel(this, 22, 22, "/ 05", "ASTEROIDS", false);
    this.dot = createPulsingDot(this, W - 22 - 4, 22 + 6, 4, COLOR_HEX.accent);

    this.scoreLabel = this.add
      .text(W / 2, 22, "", { ...TEXT_PRESETS.monoLabelFg, fontSize: "16px" })
      .setOrigin(0.5, 0);

    this.waveLabel = this.add
      .text(W - 38, 22, "", TEXT_PRESETS.monoLabel)
      .setOrigin(1, 0);

    this.livesLabel = this.add
      .text(W - 22, 44, "", TEXT_PRESETS.hint)
      .setOrigin(1, 0);

    this.bottomLeftLabel = this.add.text(22, H - 22, "GAMEDEV.05", TEXT_PRESETS.hint).setOrigin(0, 1);
    this.bottomRightLabel = this.add.text(W - 22, H - 22, isTouchDevice()
      ? "ARRASTE ESQ · TOQUE DIR · ESC MENU"
      : "← → ↑ ESPAÇO · ESC MENU · K", TEXT_PRESETS.hint).setOrigin(1, 1);

    this.refreshChrome();
  }

  private refreshChrome() {
    this.scoreLabel.setText(`SCORE  ${String(this.score).padStart(4, "0")}`);
    this.waveLabel.setText(`ONDA ${String(this.wave).padStart(2, "0")}`);
    this.livesLabel.setText(`VIDAS  ${"▲".repeat(Math.max(0, this.lives))}`);
  }

  private setupTouchControls() {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const W = this.scale.width;
      if (pointer.x < W / 2) {
        this.touchRotateActive = true;
        this.touchRotateOrigin.x = pointer.x;
        this.touchRotateOrigin.y = pointer.y;
        this.touchRotateCurrent.x = pointer.x;
        this.touchRotateCurrent.y = pointer.y;
      } else {
        const now = this.time.now;
        if (now >= this.nextFireAt && this.shipAlive) {
          this.fireBullet(now);
        }
      }
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const W = this.scale.width;
      if (this.touchRotateActive && pointer.isDown && pointer.x < W / 2 + 50) {
        this.touchRotateCurrent.x = pointer.x;
        this.touchRotateCurrent.y = pointer.y;
      }
    });
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      const W = this.scale.width;
      if (pointer.x < W / 2 + 50) {
        this.touchRotateActive = false;
      }
    });
  }
}
