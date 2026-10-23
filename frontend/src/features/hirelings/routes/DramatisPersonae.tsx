import HirelingCataloguePage from "../components/HirelingCataloguePage";
import { DRAMATIS_PERSONAE } from "../hireling-catalogue-kinds";

/** The campaign's dramatis personae: none in the book yet, so its own, to add, edit and archive. */
export default function DramatisPersonae() {
  return <HirelingCataloguePage config={DRAMATIS_PERSONAE} />;
}
