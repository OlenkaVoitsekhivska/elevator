import { Tween } from "@tweenjs/tween.js";
import { Container, Graphics } from "pixi.js";

export class Elevator {
  private _animation: Tween | null = null;
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
    this.initTween(this.container);
  }

  private initTween(graphics: Container) {
    this._animation = new Tween(graphics).dynamic(true);
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
    // this._graphics.fill(0xcccccc); // Gray fill
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

  get graphics() {
    return this.container;
  }

  set graphics(properties: any) {
    this.container = { ...this.graphics, ...properties };
  }

  get animation() {
    return this._animation;
  }
}
