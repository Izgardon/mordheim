import { SectionHead } from "@/components/ui/section-title";

import ContentSection from "./ContentSection";
import ListsSection from "./ListsSection";
import WarbandsSection from "./WarbandsSection";

/**
 * Home's Workshop (William, 27 Nov 2026: campaigns one section, the workshop another): under its
 * own title and a hairline, my custom warbands, my warband lists and my content as its parts.
 */
export default function WorkshopSections() {
  return (
    <section
      aria-labelledby="your-workshop"
      className="flex flex-col gap-6 border-t border-line pt-8 max-[960px]:gap-5 max-[960px]:pt-6"
    >
      <SectionHead id="your-workshop" title="Workshop" />
      <WarbandsSection level={3} />
      <ListsSection level={3} />
      <ContentSection />
    </section>
  );
}
