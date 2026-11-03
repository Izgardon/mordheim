import { DataCredit, Disclaimer } from "@/components/ui/disclaimer";
import { GameIconsCredit } from "@/components/ui/game-icons";

/**
 * Credit for the landing page's background video, the app's icons and its data, and the notice
 * that it isn't Games Workshop's, under the caption.
 */
export function FootageCredit() {
  return (
    <figcaption className="border-t border-line pt-3 text-xs text-faint">
      Background footage by{" "}
      <a
        href="https://www.youtube.com/@Styggosaurus"
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-text2 underline-offset-2 hover:text-head hover:underline"
      >
        Styggosaurus
      </a>
      <GameIconsCredit className="mt-1.5" />
      <DataCredit className="mt-1.5" />
      <Disclaimer className="mt-1.5" />
    </figcaption>
  );
}
