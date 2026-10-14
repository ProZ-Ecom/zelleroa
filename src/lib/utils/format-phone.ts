// "+919652312345", "919652312345" or "9652312345" -> "+91 96523 12345"
export function formatPhone(raw?: string | null): string {
  if (!raw) return "—";
  const digits = raw.replace(/\D/g, "");
  const national = digits.length > 10 ? digits.slice(-10) : digits;
  if (national.length !== 10) return raw; // unknown format: show as stored
  return `+91 ${national.slice(0, 5)} ${national.slice(5)}`;
}