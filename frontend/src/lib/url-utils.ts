export function normalizeWebUrl(rawValue: string): string {
  const trimmedValue = rawValue.trim()
  if (!trimmedValue) {
    return ""
  }

  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(trimmedValue)) {
    return trimmedValue
  }

  return `https://${trimmedValue}`
}
