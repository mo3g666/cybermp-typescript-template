mp.events.on('playerConnected', (playerId) => {
  const player = mp.players.at(playerId);
  console.log(`[Gamemode] Player joined: ${player.nickname}`);
});

console.log('[Gamemode] Server initialized!');
