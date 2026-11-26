import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { toastServerWarnings } from "@/features/warbands/utils/server-warnings";
import { getRefusalMessage } from "@/lib/get-error-message";

import { madePath } from "../paths";
import { useListToWorkshop, useWarbandToWorkshop } from "./workshop-queries";

/**
 * Copy to my workshop (a warband of mine in a campaign) and Copy to my lists (a campaign's own
 * list): the copy is made, the server's warnings toasted, and the copy opens in my workshop.
 */
export function useCopyToWorkshop() {
  const navigate = useNavigate();
  const warband = useWarbandToWorkshop();
  const list = useListToWorkshop();
  const handlers = {
    onSuccess: (made: Parameters<typeof madePath>[0]) => {
      toastServerWarnings(made.warnings);
      navigate(madePath(made));
    },
    onError: (error: unknown) => toast.error(getRefusalMessage(error, "Couldn't copy it.")),
  };
  return {
    copyWarband: (warbandId: number) => warband.mutate(warbandId, handlers),
    copyList: (templateId: number) => list.mutate(templateId, handlers),
    isCopying: warband.isPending || list.isPending,
  };
}
