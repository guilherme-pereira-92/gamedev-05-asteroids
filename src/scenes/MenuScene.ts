import Phaser from "phaser";
import { COLORS, COLOR_HEX, TEXT_PRESETS } from "../theme";
import { drawDiagonalScanlines, createPulsingDot, addCornerLabel } from "../ui";
import { takeScreenshot } from "../screenshot";
import { unlockAudio } from "../audio";
import { isTouchDevice } from "../input";

const WIDTH = 800;
const HEIGHT = 600;
const HIGHSCORE_KEY = "gamedev-05-asteroids-highscore";

export class MenuScene extends Phaser.Scene {
  private keys!: Record<"SPACE" | "ENTER" | "K", Phaser.Input.Keyboard.Key>;

  constructor() {
    super("menu");
  }

  create() {
    const high = this.loadHigh();

    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, COLOR_HEX.bg);
    drawDiagonalScanlines(this, WIDTH, HEIGHT, 15, 0.045);

    addCornerLabel(this, 22, 22, "/ 05", "ASTEROIDS", false);
    createPulsingDot(this, WIDTH - 22 - 4, 22 + 6, 4, COLOR_HEX.accent);
    this.add.text(WIDTH - 38, 22, `MELHOR  ${String(high).padStart(4, "0")}`, TEXT_PRESETS.monoLabel).setOrigin(1, 0);

    this.add.text(22, HEIGHT - 22, "GAMEDEV.05", TEXT_PRESETS.hint).setOrigin(0, 1);
    this.add.text(WIDTH - 22, HEIGHT - 22, "BRICOLAGE · GEIST", TEXT_PRESETS.hint).setOrigin(1, 1);

    this.add
      .text(WIDTH / 2, 130, "/ JORNADA GAMEDEV", { ...TEXT_PRESETS.monoLabel, color: COLORS.muted })
      .setOrigin(0.5);

    this.add
      .text(WIDTH / 2, 200, "ASTEROIDS", TEXT_PRESETS.heroOutline)
      .setOrigin(0.5)
      .setFontSize("88px");

    this.add
      .text(WIDTH / 2, 274, "destrua os asteroides · não bata em nenhum", TEXT_PRESETS.body)
      .setOrigin(0.5);

    // Decorative ship triangle
    const shipPoints = [0, -16, -12, 12, 12, 12];
    const ship = this.add.polygon(WIDTH / 2, 370, shipPoints, undefined, 0);
    ship.setStrokeStyle(2, COLOR_HEX.fg, 1);
    ship.setOrigin(0.5);
    this.tweens.add({
      targets: ship,
      angle: 360,
      duration: 9000,
      repeat: -1,
      ease: "Linear",
    });

    // Instructions block
    const instrYBase = 440;
    const instructions = isTouchDevice()
      ? [
          "↺ arraste no canto esquerdo · ESQ direção + acelera",
          "● toque no canto direito · DIR atira",
        ]
      : [
          "← → girar    ↑ acelerar    ESPAÇO atirar",
          "wrap nas bordas — sai por um lado, entra do outro",
        ];
    instructions.forEach((line, i) => {
      this.add
        .text(WIDTH / 2, instrYBase + i * 22, line, { ...TEXT_PRESETS.body, fontSize: "14px" })
        .setOrigin(0.5);
    });

    this.add
      .text(WIDTH / 2, HEIGHT - 56,
        isTouchDevice() ? "TOQUE A TELA PRA COMEÇAR" : "ESPAÇO OU ENTER PRA COMEÇAR  ·  K SCREENSHOT",
        TEXT_PRESETS.hint)
      .setOrigin(0.5);

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
