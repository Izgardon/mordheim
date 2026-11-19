/** Leaves the app for the provider's consent page (a full navigation, not a router push). */
export function leaveForProvider(url: string) {
  window.location.assign(url);
}
