import { Graphics, Text } from "pixi.js";

export class Level {
  id?: number;

  graphics: Graphics | null = null;

  constructor(
    id: number,
    private levelWidth: number,
    private levelHight: number,
    private y: number
  ) {
    this.id = id;
    this.createLevel();
  }

  private createLevel() {
    this.graphics = new Graphics()
      .rect(0, 0, this.levelWidth, this.levelHight)
      .setStrokeStyle({
        color: 0xff0000,
        width: 2,
      });
    // this._graphics.fill(0xcccccc); // Gray fill
    this.graphics.stroke();
    this.graphics.x = 0;
    this.graphics.y = this.y;
    const text = this.createLevelText(0xff0000);
    this.graphics.addChild(text);
  }

  private createLevelText(color: number) {
    const text = new Text({
      text: `Level ${this.id! + 1}`,
      style: {
        fill: color,
        fontSize: 36,
      },
    });
    text.x = this.levelWidth - text.width;
    return text;
  }
}
