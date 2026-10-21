export const AV2_MAT_RULE_AV2_MAT_01 = 'AV2-MAT-01';

export function isMoneyAmountInUnit(amount, unit) {
  if (!Number.isSafeInteger(amount) || amount < 0) return false;
  if (unit === 'reais') return amount % 100 === 0;
  if (unit === 'centavos') return amount < 100;
  return false;
}
