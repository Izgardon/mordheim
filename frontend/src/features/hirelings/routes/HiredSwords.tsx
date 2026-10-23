import HirelingCataloguePage from "../components/HirelingCataloguePage";
import { HIRED_SWORDS } from "../hireling-catalogue-kinds";

/** The campaign's hired swords: the book's and its own, to read, add, edit and archive. */
export default function HiredSwords() {
  return <HirelingCataloguePage config={HIRED_SWORDS} />;
}
