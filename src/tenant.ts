import { Graphics, Text } from "pixi.js";

export class Tenant {
  graphics: Graphics | null = null;

  constructor(
    private levelDestination: number,
    private level: number,
    public id: string,
    public x: number,
    public y: number,
    public width = 100,
    public height = 100
  ) {
    this.createTenantGraphics(width, height, x, y);
  }

  private createTenantGraphics(
    width: number,
    height: number,
    x: number,
    y: number
  ): Graphics {
    const color: number = this.direction === "up" ? 0x0000ff : 0x00ff00;
    this.graphics = new Graphics()
      .rect(0, 0, width, height)
      .setStrokeStyle({
        color,
        width: 2,
      })
      .setFillStyle({
        color: "white",
      });
    this.graphics.stroke();
    this.graphics.fill();
    this.graphics.x = x;
    this.graphics.y = y;
    this.graphics.zIndex = 1000;

    const text = this.createLevelText(color);
    //center text within the graphics
    text.x = width / 2 - text.width / 2;
    text.y = height / 2 - text.height / 2;
    this.graphics.addChild(text);
    return this.graphics.toGlobal({ x: 0, y: 0 });
  }

  private createLevelText(color: number) {
    const text = new Text({
      text: this.levelDestination + 1,
      style: {
        fill: color,
        fontSize: 16,
      },
    });
    return text;
  }

  get direction() {
    return this.levelDestination > this.level ? "up" : "down";
  }

  canBoard(direction: "up" | "down"): boolean {
    return this.direction === direction;
  }

  canExit(level: number) {
    return this.levelDestination === level;
  }
}
