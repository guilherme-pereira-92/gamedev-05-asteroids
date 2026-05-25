import Phaser from "phaser";
import { COLORS, COLOR_HEX, TEXT_PRESETS } from "../theme";
import { drawDiagonalScanlines, createPulsingDot, addCornerLabel } from "../ui";
import { takeScreenshot } from "../screenshot";
import { isTouchDevice } from "../input";
import { HIGHSCORE_KEY } from "./MenuScene";

interface InitData {
  score?: number;
  wave?: number;
}

export class GameOverScene extends Phaser.Scene {
  private score = 0;
  private wave = 1;
  private high = 0;
  private isNewRecord = false;

  private bg!: Phaser.GameObjects.Rectangle;
  private scanlines!: Phaser.GameObjects.Graphics;
  private dot!: { dot: Phaser.GameObjects.Arc; glow: Phaser.GameObjects.Arc };
  private cornerTopRight!: Phaser.GameObjects.Text;
  private cornerBottomLeft!: Phaser.GameObjects.Text;
  private labelText!: Phaser.GameObjects.Text;
  private heroText!: Phaser.GameObjects.Text;
  private detailText!: Phaser.GameObjects.Text;
  private bottomHint!: Phaser.GameObjects.Text;

  private keys!: Record<"R" | "SPACE" | "ENTER" | "ESC" | "K", Phaser.Input.Keyboard.Key>;

  constructor() {
    super("gameover");
  }

  init(data: InitData) {
    this.score = data.score ?? 0;
    this.wave = data.wave ?? 1;
    this.high = this.loadHigh();
    this.isNewRecord = this.score > this.high;
    if (this.isNewRecord) {
      this.high = this.score;
      this.saveHigh();
    }
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.bg = this.add.rectangle(W / 2, H / 2, W, H, COLOR_HEX.bg);
    this.scanlines = drawDiagonalScanlines(this, W, H, 15, 0.045);

    addCornerLabel(this, 22, 22, "/ 05", "ASTEROIDS", false);
    this.dot = createPulsingDot(this, W - 22 - 4, 22 + 6, 4, COLOR_HEX.accent);
    this.cornerTopRight = this.add.text(W - 38, 22, `MELHOR  ${String(this.high).padStart(4, "0")}`, TEXT_PRESETS.monoLabel).setOrigin(1, 0);

    this.cornerBottomLeft = this.add.text(22, H - 22, "GAMEDEV.05 · GAME OVER", TEXT_PRESETS.hint).setOrigin(0, 1);

    this.labelText = this.add
      .text(W / 2, H * 0.25, this.isNewRecord ? "NOVO RECORDE" : "GAME OVER", TEXT_PRESETS.monoLabel)
      .setOrigin(0.5)
      .setColor(this.isNewRecord ? COLORS.accent : COLORS.muted);

    this.heroText = this.add
      .text(W / 2, H * 0.42, String(this.score).padStart(4, "0"), TEXT_PRESETS.heroOutline)
      .setOrigin(0.5)
      .setFontSize(this.heroSize());

    this.detailText = this.add
      .text(W / 2, H * 0.58, `onda ${this.wave}  ·  melhor ${this.high}`, TEXT_PRESETS.body)
      .setOrigin(0.5);

    this.bottomHint = this.add
      .text(W / 2, H - 56, isTouchDevice()
        ? "TOQUE A TELA PRA JOGAR DE NOVO"
        : "R OU ESPAÇO PRA JOGAR DE NOVO  ·  ESC MENU  ·  K SCREENSHOT",
        TEXT_PRESETS.hint)
      .setOrigin(0.5);

    const kb = this.input.keyboard!;
    this.keys = {
      R: kb.addKey(Phaser.Input.Keyboard.KeyCodes.R),
      SPACE: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      ENTER: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
      ESC: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
      K: kb.addKey(Phaser.Input.Keyboard.KeyCodes.K),
    };

    this.input.on("pointerdown", () => this.scene.start("game"));
    this.scale.on("resize", this.onResize, this);
  }

  shutdown() {
    this.scale.off("resize", this.onResize, this);
  }

  private heroSize(): string {
    const W = this.scale.width;
    return `${Math.max(80, Math.min(160, Math.floor(W * 0.16)))}px`;
  }

  private onResize(gameSize: Phaser.Structs.Size) {
    const W = gameSize.width;
    const H = gameSize.height;
    this.bg.setPosition(W / 2, H / 2).setSize(W, H);
    this.scanlines.destroy();
    this.scanlines = drawDiagonalScanlines(this, W, H, 15, 0.045);
    this.dot.dot.setPosition(W - 22 - 4, 22 + 6);
    this.dot.glow.setPosition(W - 22 - 4, 22 + 6);
    this.cornerTopRight.setPosition(W - 38, 22);
    this.cornerBottomLeft.setPosition(22, H - 22);
    this.labelText.setPosition(W / 2, H * 0.25);
    this.heroText.setPosition(W / 2, H * 0.42).setFontSize(this.heroSize());
    this.detailText.setPosition(W / 2, H * 0.58);
    this.bottomHint.setPosition(W / 2, H - 56);
  }

  update() {
    const justDown = Phaser.Input.Keyboard.JustDown;
    if (justDown(this.keys.K)) takeScreenshot(this.game, "gamedev-05-asteroids-over");
    if (justDown(this.keys.R) || justDown(this.keys.SPACE) || justDown(this.keys.ENTER)) {
      this.scene.start("game");
    } else if (justDown(this.keys.ESC)) {
      this.scene.start("menu");
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

  private saveHigh() {
    try {
      localStorage.setItem(HIGHSCORE_KEY, String(this.high));
    } catch {}
  }
}
