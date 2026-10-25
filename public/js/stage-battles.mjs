/** Game-file percentages; NamuWiki comparisons are separate reviewed observations. */
export function effectiveMagnification(enemy,crown=100){
  if(!Number.isFinite(crown)||crown<=0)throw new RangeError('Invalid crown multiplier');
  const factor=enemy.crownApplies?crown/100:1;
  return {hp:enemy.hpPercent*factor,attack:enemy.attackPercent*factor};
}
export function wikiComparison(rows,observation){
  if(!observation)return 'unchecked';
  const matches=rows.filter(e=>e.enemyId===observation.enemyId);
  return matches.some(e=>e.hpPercent===observation.hpPercent&&e.attackPercent===observation.attackPercent)?'matched':'different';
}
