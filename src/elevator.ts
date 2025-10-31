import { Container, Graphics } from "pixi.js";

export class Elevator {
  public container: Container | null = null;

  constructor(
    private x: number,
    private y: number,
    private width: number,
    private height: number
  ) {
    const container = this.createContainer(
      this.x,
      this.y,
      this.width,
      this.height
    );
    this.container = container;
  }

  private createContainer(
    x: number,
    y: number,
    width: number,
    height: number
  ): Container {
    const outlineBox = new Graphics().rect(0, 0, width, height).setStrokeStyle({
      color: 0xff0000,
      width: 2,
    });
    outlineBox.stroke();

    const container = new Container({
      isRenderGroup: true,
    });
    container.allowChildren = true;
    container.setSize(width, height);
    container.addChild(outlineBox);
    container.visible = true;
    container.alpha = 1;
    container.x = x;
    container.y = y;
    return container;
  }
}
