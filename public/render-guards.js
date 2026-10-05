export function briefingItems(card) {
  return Array.isArray(card?.items) ? card.items : [];
}

export function renderCardSafely(renderers,card) {
  const renderer=renderers?.[card?.type];
  if (!renderer) return {node:null,error:null};
  try {
    return {node:renderer(card),error:null};
  } catch (error) {
    return {node:null,error:error instanceof Error ? error.message : String(error)};
  }
}
