export function currencySymbol(currency: string) {
  return `${currency} `;
}

export function formatMoney(value: string | number, currency: string) {
  const numeric = Number(value);
  const amount = Number.isFinite(numeric) ? numeric : 0;
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `${currencySymbol(currency)}${amount.toLocaleString("en-GB", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }
}

export function formatPercent(value: string | number) {
  const numeric = Number(value);
  return `${Number.isFinite(numeric) ? numeric.toFixed(2) : "0.00"}%`;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}
