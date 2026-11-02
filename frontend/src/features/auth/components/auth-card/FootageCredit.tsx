import { GameIconsCredit } from "@/components/ui/game-icons";

/** Credit for the landing page's background video and the app's icons, under the caption. */
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
    </figcaption>
  );
}
