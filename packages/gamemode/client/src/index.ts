import { DEFAULT_SPAWN } from '@gamemode/shared';

console.log('[Gamemode] Client initialized');

mp.game.onGameLoaded(() => {
  mp.local.spawnPlayer(...DEFAULT_SPAWN);
});
