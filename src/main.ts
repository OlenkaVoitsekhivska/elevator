import { Game } from "./game";
import { AnimationConfig } from "./models";

(async () => {
  const ANIMATION_CONFIG: AnimationConfig = {
    levels_number: 4,
    elevator_capacity: 3,
  };
  const game = new Game(ANIMATION_CONFIG);
  await game.setup();
  game.elevatorLoop();
  game.startTicker();
})();
