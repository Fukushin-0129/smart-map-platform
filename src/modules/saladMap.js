export function isSaladRelatedStore(store, layer) {
  if (!store.layerId) return true;
  const haystack = [store.layerName, store.category, store.description, layer?.name, layer?.fileName].join(' ').toLowerCase();
  return haystack.includes('サラダ') || haystack.includes('salad');
}
