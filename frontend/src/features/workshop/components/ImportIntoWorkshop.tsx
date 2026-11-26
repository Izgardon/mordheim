import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { toastServerWarnings } from "@/features/warbands/utils/server-warnings";

import { useImportIntoWorkshop } from "../api/workshop-queries";
import { madePath } from "../paths";
import ImportCodeDialog from "./ImportCodeDialog";
import { SECTION_BUTTON } from "./HomeSection";

/** Import by code: a shared warband or list, read first, copied into my workshop and opened. */
export default function ImportIntoWorkshop() {
  const navigate = useNavigate();
  const importing = useImportIntoWorkshop();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" className={SECTION_BUTTON} onClick={() => setOpen(true)}>
        Import by code
      </Button>
      <ImportCodeDialog
        open={open}
        onOpenChange={setOpen}
        kicker="Workshop"
        title="Import by code"
        onImport={async (code) => {
          const made = await importing.mutateAsync(code);
          toastServerWarnings(made.warnings);
          navigate(madePath(made));
        }}
      />
    </>
  );
}
