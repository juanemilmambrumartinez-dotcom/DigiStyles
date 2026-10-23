import { brand } from "@/config/brand.config";

export type CurrencyCode = keyof typeof brand.monedas;
export const currencyCookieName = "digistyles_currency";

export function isCurrencyCode(value: string | undefined): value is CurrencyCode {
  return Boolean(value && value in brand.monedas);
}

export function getCurrency(code: CurrencyCode) {
  return brand.monedas[code];
}

export function convertFromBase(amountInDop: number, currency: CurrencyCode) {
  return amountInDop * getCurrency(currency).tasaDesdeDop;
}

export function convertToBase(amount: number, currency: CurrencyCode) {
  if (currency === brand.monedaBase) return amount;
  return amount / getCurrency(currency).tasaDesdeDop;
}

export function formatPrice(amountInDop: number, currency: CurrencyCode) {
  const currencyConfig = getCurrency(currency);
  const converted = convertFromBase(amountInDop, currency);
  return new Intl.NumberFormat(currencyConfig.locale, {
    style: "currency",
    currency: currencyConfig.codigo,
    maximumFractionDigits: currencyConfig.codigo === "DOP" ? 0 : 2,
  }).format(converted);
}
