export const AV2_MAT_RULE_AV2_MAT_01 = 'AV2-MAT-01';
export const AV2_MAT_RULE_AV2_MAT_02 = 'AV2-MAT-02';

// AV2-MAT-01 keeps operands in one unit; AV2-MAT-02 keeps the result there too.
export function isMoneyAmountInUnit(amount, unit) {
  if (!Number.isSafeInteger(amount) || amount < 0) return false;
  if (unit === 'reais') return amount % 100 === 0;
  if (unit === 'centavos') return amount < 100;
  return false;
}

export function isMoneyOperationInUnit(amounts, result, unit) {
  return Array.isArray(amounts)
    && amounts.length > 0
    && amounts.every((amount) => isMoneyAmountInUnit(amount, unit))
    && isMoneyAmountInUnit(result, unit);
}
