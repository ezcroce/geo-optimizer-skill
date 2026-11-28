// Private heist actions must not identify the thief in public event packets.
export function canReceiveEvent(event, recipientId, state) {
  if (event.type === 'jewel_stolen' || event.type === 'secret_passage') return event.playerId === recipientId;
  if (event.type === 'diamond_stashed' || event.type === 'diamond_retrieved') {
    return state?.players.some(p => p.id === recipientId && p.role === 'thief');
  }
  return true;
}

export function publicJewels(jewels, reveal) {
  return Object.fromEntries(Object.entries(jewels).map(([id, jewel]) => [id, {
    ...jewel,
    stolenBy: reveal ? jewel.stolenBy : null,
  }]));
}
