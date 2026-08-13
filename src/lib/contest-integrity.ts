/**
 * Fullscreen can only be entered while the browser considers a user gesture
 * active. Call this from the "enter contest" click, then use the workspace
 * guard as the fallback for direct links and browsers that deny the request.
 */
export async function requestContestFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  if (document.fullscreenElement) return true;
  if (!document.fullscreenEnabled || !document.documentElement.requestFullscreen) return false;

  try {
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    return Boolean(document.fullscreenElement);
  } catch {
    return false;
  }
}
