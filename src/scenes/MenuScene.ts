import Phaser from "phaser";
import { COLORS, COLOR_HEX, TEXT_PRESETS } from "../theme";
import { drawDiagonalScanlines, createPulsingDot, addCornerLabel } from "../ui";
import { takeScreenshot } from "../screenshot";
import { unlockAudio } from "../audio";
import { isTouchDevice } from "../input";

const HIGHSCORE_KEY = "gamedev-05-asteroids-highscore";

export class MenuScene extends Phaser.Scene {
  private keys!: Record<"SPACE" | "ENTER" | "K", Phaser.Input.Keyboard.Key>;
  private bg!: Phaser.GameObjects.Rectangle;
  private scanlines!: Phaser.GameObjects.Graphics;
  private titleLabel!: Phaser.GameObjects.Text;
  private titleHero!: Phaser.GameObjects.Text;
  private titleSub!: Phaser.GameObjects.Text;
  private ship!: Phaser.GameObjects.Polygon;
  private cornerTopRight!: Phaser.GameObjects.Text;
  private cornerBottomRight!: Phaser.GameObjects.Text;
  private cornerBottomLeft!: Phaser.GameObjects.Text;
  private instructions: Phaser.GameObjects.Text[] = [];
  private bottomHint!: Phaser.GameObjects.Text;
  private dot!: { dot: Phaser.GameObjects.Arc; glow: Phaser.GameObjects.Arc };

  constructor() {
    super("menu");
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    const high = this.loadHigh();

    this.bg = this.add.rectangle(W / 2, H / 2, W, H, COLOR_HEX.bg);
    this.scanlines = drawDiagonalScanlines(this, W, H, 15, 0.045);

    addCornerLabel(this, 22, 22, "/ 05", "ASTEROIDS", false);

    this.dot = createPulsingDot(this, W - 22 - 4, 22 + 6, 4, COLOR_HEX.accent);
    this.cornerTopRight = this.add.text(W - 38, 22, `MELHOR  ${String(high).padStart(4, "0")}`, TEXT_PRESETS.monoLabel).setOrigin(1, 0);

    this.cornerBottomLeft = this.add.text(22, H - 22, "GAMEDEV.05", TEXT_PRESETS.hint).setOrigin(0, 1);
    this.cornerBottomRight = this.add.text(W - 22, H - 22, "BRICOLAGE · GEIST", TEXT_PRESETS.hint).setOrigin(1, 1);

    this.titleLabel = this.add
      .text(W / 2, H * 0.18, "/ JORNADA GAMEDEV", { ...TEXT_PRESETS.monoLabel, color: COLORS.muted })
      .setOrigin(0.5);

    this.titleHero = this.add
      .text(W / 2, H * 0.32, "ASTEROIDS", TEXT_PRESETS.heroOutline)
      .setOrigin(0.5)
      .setFontSize(this.heroSize());

    this.titleSub = this.add
      .text(W / 2, H * 0.44, "destrua os asteroides · não bata em nenhum", TEXT_PRESETS.body)
      .setOrigin(0.5);

    const shipPoints = [0, -16, -12, 12, 12, 12];
    this.ship = this.add.polygon(W / 2, H * 0.56, shipPoints, undefined, 0);
    this.ship.setStrokeStyle(2, COLOR_HEX.fg, 1);
    this.ship.setOrigin(0.5);
    this.tweens.add({ targets: this.ship, angle: 360, duration: 9000, repeat: -1, ease: "Linear" });

    this.drawInstructions();
    this.drawBottomHint();

    const kb = this.input.keyboard!;
    this.keys = {
      SPACE: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      ENTER: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
      K: kb.addKey(Phaser.Input.Keyboard.KeyCodes.K),
    };
    kb.on("keydown", unlockAudio);
    this.input.on("pointerdown", () => {
      unlockAudio();
      this.scene.start("game");
    });

    this.scale.on("resize", this.onResize, this);
  }

  shutdown() {
    this.scale.off("resize", this.onResize, this);
  }

  private heroSize(): string {
    const W = this.scale.width;
    return `${Math.max(56, Math.min(120, Math.floor(W * 0.11)))}px`;
  }

  private drawInstructions() {
    for (const t of this.instructions) t.destroy();
    this.instructions = [];
    const lines = isTouchDevice()
      ? [
          "← arraste no canto esquerdo: direção + acelera",
          "● toque no canto direito: atira",
        ]
      : [
          "← → girar    ↑ acelerar    ESPAÇO atirar",
          "wrap nas bordas — sai por um lado, entra do outro",
        ];
    const W = this.scale.width;
    const H = this.scale.height;
    lines.forEach((line, i) => {
      const t = this.add
        .text(W / 2, H * 0.72 + i * 22, line, { ...TEXT_PRESETS.body, fontSize: "14px" })
        .setOrigin(0.5);
      this.instructions.push(t);
    });
  }

  private drawBottomHint() {
    const W = this.scale.width;
    const H = this.scale.height;
    if (this.bottomHint) this.bottomHint.destroy();
    this.bottomHint = this.add
      .text(W / 2, H - 56,
        isTouchDevice() ? "TOQUE A TELA PRA COMEÇAR" : "ESPAÇO OU ENTER PRA COMEÇAR  ·  K SCREENSHOT",
        TEXT_PRESETS.hint)
      .setOrigin(0.5);
  }

  private onResize(gameSize: Phaser.Structs.Size) {
    const W = gameSize.width;
    const H = gameSize.height;
    this.bg.setPosition(W / 2, H / 2).setSize(W, H);
    this.scanlines.destroy();
    this.scanlines = drawDiagonalScanlines(this, W, H, 15, 0.045);
    // Re-add corner labels (recreated for cleanliness)
    this.dot.dot.setPosition(W - 22 - 4, 22 + 6);
    this.dot.glow.setPosition(W - 22 - 4, 22 + 6);
    this.cornerTopRight.setPosition(W - 38, 22);
    this.cornerBottomLeft.setPosition(22, H - 22);
    this.cornerBottomRight.setPosition(W - 22, H - 22);

    this.titleLabel.setPosition(W / 2, H * 0.18);
    this.titleHero.setPosition(W / 2, H * 0.32).setFontSize(this.heroSize());
    this.titleSub.setPosition(W / 2, H * 0.44);
    this.ship.setPosition(W / 2, H * 0.56);

    this.drawInstructions();
    this.drawBottomHint();
  }

  update() {
    const justDown = Phaser.Input.Keyboard.JustDown;
    if (justDown(this.keys.K)) {
      takeScreenshot(this.game, "gamedev-05-asteroids-menu");
    }
    if (justDown(this.keys.SPACE) || justDown(this.keys.ENTER)) {
      this.scene.start("game");
    }
  }

  private loadHigh(): number {
    try {
      const raw = localStorage.getItem(HIGHSCORE_KEY);
      const n = raw ? parseInt(raw, 10) : 0;
      return Number.isFinite(n) && n > 0 ? n : 0;
    } catch {
      return 0;
    }
  }
}

export { HIGHSCORE_KEY };
