function pveRewardPreview(fight){
  if(!fight)return '';
  if(fight.wonWithLovys||(fight.accountWon===true&&fight.replayRewardAvailable===false))return 'Déjà gagné avec ce Lovys : aucune nouvelle récompense.';
  const r=fight.rewards||{},range=fight.cashRange||(fight.boss?{min:10,max:10}:{min:3,max:5});
  const cash=range.min===range.max?range.min:`${range.min} à ${range.max}`;
  const base=`+${Number(r.creatureXp||0)} XP Lovys · +${cash} LoVeR’Cash`;
  return Boolean(fight.accountWon??fight.won)?`Première victoire avec ce Lovys : ${base}`:`Première victoire : ${base} · +${Number(r.globalXp||0)} XP globale · +${Number(r.fragments||0)} fragments d’œuf`;
}
function pveResultRewardText(result){
  if(!result.victory)return '';
  if(!result.firstLovysWin)return 'Déjà gagné avec ce Lovys : aucune nouvelle récompense.';
  const r=result.reward||{};
  const base=`+${Number(r.creatureXp||0)} XP Lovys · +${Number(r.cash||0)} LoVeR’Cash`;
  return result.firstWin?`Première victoire : ${base} · +${Number(r.globalXp||0)} XP globale · +${Number(r.fragments||0)} fragments d’œuf`:`Première victoire avec ce Lovys : ${base}`;
}
