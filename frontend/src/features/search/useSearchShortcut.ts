import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/** The search field's id on the Search everything page (the shortcut focuses it). */
export const SEARCH_FIELD_ID = "search-everything";

const isTyping = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
};

/**
 * Search everything's keyboard shortcut on the web (next step 7a): `/` (when not typing in a
 * field) or Ctrl+K / Cmd+K opens `/campaigns/:id/search` from anywhere in the campaign and puts
 * the cursor in its field.
 */
export function useSearchShortcut(campaignId: number, enabled: boolean) {
  const navigate = useNavigate();
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      const slash = event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey;
      const commandK = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      if (!commandK && !(slash && !isTyping(event.target))) return;
      event.preventDefault();
      const field = document.getElementById(SEARCH_FIELD_ID);
      if (field) {
        field.focus();
        return;
      }
      navigate(`/campaigns/${campaignId}/search`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [campaignId, enabled, navigate]);
}
