export async function playRecipe(recipe) {
  if (!/^[a-z]+$/.test(recipe)) return;
  const [{ playSound }, { default: config }] = await Promise.all([
    import('./sound-engine.mjs'),
    import('./sounds/' + recipe + '.mjs'),
  ]);
  return playSound(config, { volume: -5 });
}
