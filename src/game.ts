import { Application } from "pixi.js";
import { Elevator } from "./elevator";
import * as PIXI from "pixi.js";
import { Level } from "./level";
import { Tenant } from "./tenant";
import { AnimationConfig } from "./models";
import { Tween } from "@tweenjs/tween.js";
import * as TWEEN from "@tweenjs/tween.js";
import { TweenManager } from "./tween-manager";

type ElevatorStatus = "idle" | "moving";

export class Game {
  private app: Application | null = null;
  private appartmentHeight: number = 0;
  private levelHeight: number = 0;
  private elevatorRef: Elevator | null = null;
  private levels?: Level[];
  private levelsNumber = 0;
  private currentLevel = 0;
  private direction: "up" | "down" = "up";
  private tenantsMap = new Map<
    number,
    {
      tenants: Tenant[];
      waitingTenants: Tenant[];
      waitingZoneTenants: Map<number, Tenant | null>;
    }
  >();

  private readonly tweenManager = TweenManager.getInstance();

  private ticker = new PIXI.Ticker();

  private ELEVATOR_STATE: {
    status: ElevatorStatus;
    tenants: Map<number, Tenant | null>;
    capacity: number;
  } = {
    status: "idle",
    tenants: new Map(),
    capacity: 0,
  };

  private TENANT_SIZE = 100;
  private ELEVATOR_WIDTH = 0;

  private ANIMATION_DURATION = {
    ELEVATOR: 1000,
    PAUSE: 800,
    TENANT_BOARDING: 300,
  };

  private gameStatus:
    | "request_tenants_unboarding"
    | "request_tenants_boarding"
    | "request_tenant_elevator_movement"
    | "request_pause"
    | "request_elevator_move"
    | null = null;

  private intervalsRef: number[] = [];

  constructor(config: AnimationConfig) {
    this.levelsNumber = config.levels_number;
    const capacity = config.elevator_capacity;
    const elevatorTenantsMap = this.ELEVATOR_STATE.tenants;
    this.ELEVATOR_STATE = {
      ...this.ELEVATOR_STATE,
      capacity,
    };
    this.initTenantsInElevatorMap(capacity, elevatorTenantsMap);
    this.ELEVATOR_WIDTH = this.TENANT_SIZE * config.elevator_capacity;
  }

  private initTenantsInElevatorMap(
    capacity: number,
    mapRef: Map<number, Tenant | null>
  ): void {
    Array.from({ length: capacity }, (_, index) => {
      mapRef.set(index, null);
    });
  }

  private updateWaitingTenantsOnLevel(
    level: number,
    transferredTenants: Tenant | Tenant[]
  ): void {
    const handleTenantsUpdate = (
      tenant: Tenant | Tenant[],
      waitingId: string
    ) => {
      if (!Array.isArray(tenant)) {
        return tenant.id !== waitingId;
      }
      return tenant.every((transferred) => transferred.id !== waitingId);
    };
    const levelData = this.findLevelData(level);
    if (levelData) {
      const updatedWaitingTenants = levelData?.waitingTenants.filter(
        (waiting) => handleTenantsUpdate(transferredTenants, waiting.id)
      );

      this.tenantsMap.set(level, {
        ...levelData,
        waitingTenants: updatedWaitingTenants,
      });
    }
  }

  private createLevelDestination(level: number) {
    let result = this.getRandomInteger(0, this.levelsNumber - 1);
    while (result === level) {
      result = this.getRandomInteger(0, this.levelsNumber - 1);
    }
    return result;
  }

  private calcNextLevel(): number {
    const current = this.currentLevel;
    if (this.direction === "up") {
      return current + 1;
    } else {
      return current - 1;
    }
  }

  async setup(): Promise<void> {
    this.app = new Application();

    await this.app.init({
      background: "#1099bb",
      resizeTo: window,
    });

    document.getElementById("pixi-container")!.appendChild(this.app.canvas);

    this.appartmentHeight = this.app.screen.height;
    this.levelHeight = this.appartmentHeight / this.levelsNumber;

    this.initElevator();
    this.initLevels();
    this.spawnTenantsByLevel();
  }

  spawnTenantsByLevel() {
    this.levels?.forEach((level) => {
      const levelId = level.id as number;
      let tenantCount = 0;
      const SMALL_INTERVAL = 4000;
      const LARGE_INTERVAL = 10000;

      const spawnInterval = this.getRandomInteger(
        SMALL_INTERVAL,
        LARGE_INTERVAL
      );

      const intervalId = setInterval(() => {
        const vacantSpots = this.vacantSpotsInWaitingZone(levelId);

        if (!vacantSpots.length) {
          return;
        }

        const tenant = this.spawnTenants(levelId, tenantCount);
        tenantCount += 1;
        this.updateTenantMapAfterSpawn(levelId, tenant);
        this.moveTenantsToWaitingZone(levelId, tenant);
      }, spawnInterval);

      this.intervalsRef.push(intervalId);
    });
  }

  private calcElevatorYPosition(level: number) {
    const y = this.appartmentHeight - (level + 1) * this.levelHeight;
    return y;
  }

  private initElevator() {
    const y = this.calcElevatorYPosition(this.currentLevel);
    const elevator = new Elevator(0, y, this.ELEVATOR_WIDTH, this.levelHeight);
    this.elevatorRef = elevator;
    if (elevator.container) {
      this.app?.stage.addChild(elevator.container);
    }
  }

  private initLevels() {
    const DEFAULT_LEVEL_WIDTH = 200;
    this.levels = Array.from({ length: this.levelsNumber }, (_, levelIndex) => {
      const levelY =
        this.appartmentHeight - (levelIndex + 1) * this.levelHeight;
      const level = new Level(
        levelIndex,
        this.app?.screen.width || DEFAULT_LEVEL_WIDTH,
        this.levelHeight,
        levelY
      );
      if (level.graphics) {
        this.app?.stage.addChild(level.graphics);
      }

      this.tenantsMap.set(levelIndex, {
        tenants: [],
        waitingTenants: [],
        waitingZoneTenants: new Map(
          Array.from(
            { length: this.ELEVATOR_STATE.capacity },
            (item, index) => [index, null]
          )
        ),
      });
      return level;
    });
  }

  private getRandomInteger(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  startTicker() {
    this.ticker.add(() => {
      this.tweenManager.updateMainLoopGroup();
      this.tweenManager.updateTenantsApproachingWaitingZoneGroup();
      this.tweenManager.updateUnboardingTenantsGroup();
    });
    this.ticker.start();
  }

  elevatorLoop() {
    const waitingZoneTenants = this.waitingZoneByLevel(this.currentLevel);

    const hasWaitingTenants = waitingZoneTenants.some(
      ([index, tenant]) => tenant !== null
    );

    if (hasWaitingTenants) {
      this.gameStatus = "request_pause";
      this.actionHandler(this.gameStatus);
    } else {
      this.gameStatus = "request_elevator_move";
      this.actionHandler(this.gameStatus);
    }
  }

  private actionHandler(status: typeof this.gameStatus) {
    switch (status) {
      case null:
      case "request_elevator_move":
        {
          this.ELEVATOR_STATE.status = "moving";
          this.moveElevator();
        }
        break;

      case "request_pause": {
        const pauseAnimation = new TWEEN.Tween({}).duration(
          this.ANIMATION_DURATION.PAUSE
        );
        this.tweenManager.addTweenToMainLoopGroup(pauseAnimation);
        this.ELEVATOR_STATE.status = "idle";
        pauseAnimation.onStart(() => {
          this.gameStatus = "request_tenants_unboarding";
          this.actionHandler(this.gameStatus);
        });
        pauseAnimation.start();
        break;
      }
      case "request_tenants_unboarding":
        this.unboardTenants(this.currentLevel);
        break;
      case "request_tenants_boarding":
        this.boardTenants(this.currentLevel);
        break;
    }
  }

  private moveElevator() {
    const nextLevel = this.calcNextLevel();
    if (nextLevel === this.levelsNumber - 1) {
      this.direction = "down";
    }
    if (nextLevel === 0) {
      this.direction = "up";
    }
    const nextLevelY = this.calcElevatorYPosition(nextLevel);

    const elevatorAnimation = new Tween(
      this.elevatorRef?.container as PIXI.Container
    )
      .to({ y: nextLevelY }, this.ANIMATION_DURATION.ELEVATOR)
      .onStart(() => {
        this.animateElevatorChildren(nextLevelY);
      })
      .onComplete(() => {
        this.currentLevel = nextLevel;
        this.gameStatus = "request_pause";
        this.actionHandler(this.gameStatus);
      });

    this.tweenManager.addTweenToMainLoopGroup(elevatorAnimation);
    elevatorAnimation.start();
  }

  private moveTenantsToWaitingZone(level: number, tenant: Tenant) {
    const vacantSpots = this.vacantSpotsInWaitingZone(level);

    if (!vacantSpots.length) {
      return;
    }
    const spot = this.vacantSpotsInWaitingZone(level);
    const x = this.ELEVATOR_WIDTH + spot[0][0] * this.TENANT_SIZE;
    const animation = new Tween(tenant.graphics as PIXI.Graphics)
      .to({ x })
      .onComplete(() => {
        this.addToWaitingZoneByLevel(level, tenant);
      });

    this.tweenManager.addTweenToApproachingWaitingZoneTenantsGroup(animation);
    animation.start();
  }

  private boardTenants(level: number) {
    const boardingTenants = this.waitingZoneByLevel(level).filter(
      ([waitingSpot, tenant]) => tenant && tenant?.canBoard(this.direction)
    );
    const vacantSpots = this.vacantSpotsInWaitingZone(level);
    const canBoardNumber = Math.min(vacantSpots.length, boardingTenants.length);
    let boardedCount = 0;

    if (!canBoardNumber) {
      this.gameStatus = "request_elevator_move";
      return this.actionHandler(this.gameStatus);
    }
    for (let i = 0; i < boardingTenants.length; i++) {
      const elevatorState = {
        ...this.ELEVATOR_STATE,
      };

      if (!this.elevatorHasVacantSpots()) {
        this.gameStatus = "request_elevator_move";
        return this.actionHandler(this.gameStatus);
      }
      if (elevatorState.status === "moving") {
        return;
      }

      const [waitingSpot, tenant] = boardingTenants[i] as [number, Tenant];
      const vacantSpot = this.findSpotInElevator();

      if (vacantSpot !== null) {
        const updatedTenants = new Map(this.ELEVATOR_STATE.tenants);
        updatedTenants.set(vacantSpot, tenant);

        this.ELEVATOR_STATE = {
          ...this.ELEVATOR_STATE,
          tenants: updatedTenants,
        };

        const targetX = this.TENANT_SIZE * vacantSpot;

        const animation = new Tween(tenant.graphics as PIXI.Graphics)
          .to({ x: targetX }, this.ANIMATION_DURATION.TENANT_BOARDING)
          .onComplete(() => {
            this.removeFromWaitingZoneByLevel(level, tenant);
            this.updateWaitingTenantsOnLevel(level, tenant);
            boardedCount += 1;
            if (boardedCount === canBoardNumber) {
              this.gameStatus = "request_elevator_move";
              this.actionHandler(this.gameStatus);
            }
          });

        this.tweenManager.addTweenToMainLoopGroup(animation);
        animation.start();
      }
    }
  }

  private elevatorHasVacantSpots(): boolean {
    const spots = this.ELEVATOR_STATE.tenants;
    return Array.from(spots).some(([_index, tenant]) => !tenant);
  }

  private findSpotInElevator(): number | null {
    const spots = this.ELEVATOR_STATE.tenants;
    const vacantSpotIndex = Array.from(spots).findIndex(
      ([_index, tenant]) => !tenant
    );
    return vacantSpotIndex >= 0 ? vacantSpotIndex : null;
  }

  private unboardTenants(level: number) {
    const tenantsInElevator = this.ELEVATOR_STATE.tenants;
    const exiting = Array.from(tenantsInElevator).filter(([_, tenant]) =>
      tenant?.canExit(level)
    );

    if (!exiting.length) {
      this.gameStatus = "request_tenants_boarding";
      return this.actionHandler(this.gameStatus);
    }

    let exitingCount = 0;
    const tenantY =
      this.calcElevatorYPosition(level) + this.levelHeight - this.TENANT_SIZE;

    exiting.forEach(([spot, tenant]) => {
      const animation = new Tween(tenant?.graphics as PIXI.Graphics)
        .to(
          {
            x: this.app?.screen.width,
            y: tenantY,
          },
          this.ANIMATION_DURATION.TENANT_BOARDING
        )
        .onComplete(() => {
          const updatedTenants = new Map(this.ELEVATOR_STATE.tenants);
          updatedTenants.set(spot, null);
          this.removeFromWaitingTenantsByLevel(level, tenant as Tenant);
          this.ELEVATOR_STATE = {
            ...this.ELEVATOR_STATE,
            tenants: updatedTenants,
          };

          exitingCount += 1;

          if (exitingCount === exiting.length) {
            this.gameStatus = "request_tenants_boarding";
            this.actionHandler(this.gameStatus);
          }
        });
      this.tweenManager.addTweenToUnboardingTenantsGroup(animation);
      animation.start();
    });
  }

  private findLevelData(level: number) {
    return this.tenantsMap.get(level);
  }

  private addToWaitingZoneByLevel(level: number, tenant: Tenant): void {
    const levelData = this.findLevelData(level);
    if (!levelData) {
      return;
    }
    const vacantSpot = Array.from(levelData.waitingZoneTenants).find(
      ([index, tenant]) => !tenant
    )?.[0];
    if (vacantSpot === undefined) {
      return;
    }
    levelData.waitingZoneTenants.set(vacantSpot, tenant);
  }

  private removeFromWaitingZoneByLevel(level: number, tenant: Tenant): void {
    const waitingZone = this.waitingZoneByLevel(level);
    const tenantIndex = waitingZone.find(
      ([spotId, waitingTenant]) => tenant.id === waitingTenant?.id
    )?.[0];
    if (tenantIndex === undefined) {
      return;
    }
    const levelData = this.findLevelData(level)!;
    levelData.waitingZoneTenants.set(tenantIndex, null);
  }

  private removeFromWaitingTenantsByLevel(level: number, tenant: Tenant): void {
    const levelData = this.findLevelData(level);
    if (!levelData) {
      return;
    }

    this.tenantsMap.set(level, {
      ...levelData,
      waitingTenants: levelData.waitingTenants.filter(
        (waitingTenant) => waitingTenant.id !== tenant.id
      ),
    });
  }

  private animateElevatorChildren(nextLevelY: number) {
    const tenants = Array.from(this.ELEVATOR_STATE.tenants).map(
      ([_index, tenant]) => tenant
    );
    if (tenants.every((tenant) => !tenant)) {
      return;
    }
    for (let i = 0; i < tenants.length; i++) {
      const tenant = tenants[i];
      if (!tenant) {
        continue;
      }
      const targetY = nextLevelY + this.levelHeight - this.TENANT_SIZE;
      const animation = new TWEEN.Tween(tenant?.graphics as PIXI.Graphics).to(
        {
          y: targetY,
        },
        this.ANIMATION_DURATION.ELEVATOR
      );

      this.tweenManager.addTweenToMainLoopGroup(animation);
      animation.start();
    }
  }

  private spawnTenants(level: number, tenantIndex: number) {
    const screenWidth = this.app?.screen.width as number;

    const tenantLevelDestination = this.createLevelDestination(level);
    const tenantId = `level-${level}__tenant-${tenantIndex}`;
    const levelY = this.appartmentHeight - (level + 1) * this.levelHeight;
    const tenantX = screenWidth + this.TENANT_SIZE * tenantIndex; //initially hide (right margin)
    const tenant = new Tenant(
      tenantLevelDestination,
      level,
      tenantId,
      tenantX,
      levelY + this.TENANT_SIZE,
      this.TENANT_SIZE
    );
    if (tenant.graphics) {
      this.app?.stage.addChild(tenant.graphics);
    }

    return tenant;
  }

  private updateTenantMapAfterSpawn(level: number, tenant: Tenant): void {
    const levelData = this.findLevelData(level);
    if (!levelData) {
      return;
    }

    const preexistingTenants = levelData?.tenants || [];
    const preexistingWaitingTenants = levelData?.waitingTenants || [];

    levelData.tenants = [...preexistingTenants, tenant];
    levelData.waitingTenants = [...preexistingWaitingTenants, tenant];
  }

  private waitingZoneByLevel(level: number): [number, Tenant | null][] {
    const levelData = this.findLevelData(level);
    if (!levelData) {
      return [];
    }
    return Array.from(levelData.waitingZoneTenants);
  }
  private vacantSpotsInWaitingZone(level: number): [number, Tenant | null][] {
    const levelData = this.findLevelData(level);
    if (!levelData) {
      return [];
    }
    return this.waitingZoneByLevel(level).filter(
      ([index, tenant]) => tenant === null
    );
  }
}
