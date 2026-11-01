export const coupleName = "Zuzanna & Adam";

export const weddingMessage =
  "Podzielcie się z nami chwilami uchwyconymi podczas tego wyjątkowego dnia. Chcemy zobaczyć to, czego sami mogliśmy nie dostrzec, i zachować jak najwięcej wspomnień z tego dnia.";

export function photoWord(count: number) {
  if (count === 1) return "zdjęcie";
  const last = count % 10;
  const lastTwo = count % 100;
  return last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)
    ? "zdjęcia"
    : "zdjęć";
}

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
