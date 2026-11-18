/** Display USD-denominated legacy/demo records as PKR per the Haven workspace convention. */
/** @param {string} currency */
export function displayCurrencyCode(currency) {
  return currency === "USD" ? "PKR" : currency;
}

/** @param {string | number | null} amount @param {string} currency */
export function formatMoney(amount, currency) {
  const code = displayCurrencyCode(currency);
  if (amount === null) return `${code} —`;
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return `${code} ${amount}`;
  return `${code} ${numericAmount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
