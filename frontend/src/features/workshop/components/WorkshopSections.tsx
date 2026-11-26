import ContentSection from "./ContentSection";
import ListsSection from "./ListsSection";
import WarbandsSection from "./WarbandsSection";

/** Home's workshop: my custom warbands, my warband lists and my content. */
export default function WorkshopSections() {
  return (
    <>
      <WarbandsSection />
      <ListsSection />
      <ContentSection />
    </>
  );
}
