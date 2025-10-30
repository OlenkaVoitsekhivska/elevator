import { Tween, Group } from "@tweenjs/tween.js";

export class TweenManager {
  private static instance: TweenManager;
  private elevatorAnimationGroup = new Group();
  private tenantsApproachingWaitingZoneGroup = new Group();
  private unboardingTenantsGroup = new Group();

  public static getInstance(): TweenManager {
    if (!TweenManager.instance) {
      TweenManager.instance = new TweenManager();
    }
    return TweenManager.instance;
  }

  addTweenToMainLoopGroup(tween: Tween) {
    this.elevatorAnimationGroup.add(tween);
  }

  removeTweenFromMeinLoop(tween: Tween) {
    this.elevatorAnimationGroup.remove(tween);
  }

  addTweenToApproachingWaitingZoneTenantsGroup(tween: Tween) {
    this.tenantsApproachingWaitingZoneGroup.add(tween);
  }

  addTweenToUnboardingTenantsGroup(tween: Tween) {
    this.unboardingTenantsGroup.add(tween);
  }

  updateMainLoopGroup() {
    this.elevatorAnimationGroup.update();
  }

  updateTenantsApproachingWaitingZoneGroup() {
    this.tenantsApproachingWaitingZoneGroup.update();
  }

  updateUnboardingTenantsGroup() {
    this.unboardingTenantsGroup.update();
  }
}
