// Won fights remain replayable when new encounters are inserted before them.
// Callers supply only victory counts read from the player's persisted progress.
export function isPveFightUnlocked(previousFight, previousWins, ownWins = 0) {
  return Number(ownWins) > 0 || !previousFight || Number(previousWins) > 0;
}
