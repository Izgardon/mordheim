import { useState } from "react";
import { toast } from "sonner";
import { Dices } from "lucide-react";

import { Button } from "@/components/ui/button";
import DiceEntry from "@/components/ui/dice-entry";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import { useWarbandCacheUpdate } from "../../api/warband-cache";
import { unitApi } from "../../units/unit-api";
import { BLOOD_PACT_RULE, PACT_ROLL, pactTotal, type PactLine } from "./blood-pacts";
import type { OpenCamp } from "./camp-types";

/** One hired sword's 2D6, rolled or typed in, with his +1 per skill or characteristic increase. */
function PactRow({ camp, line }: { camp: OpenCamp; line: PactLine }) {
  const updateCache = useWarbandCacheUpdate();
  const [faces, setFaces] = useState<(number | null)[]>([]);
  const [swearing, setSwearing] = useState(false);
  const total = pactTotal(faces, line.bonus);
  const sworn = total !== null && total >= PACT_ROLL;

  const swear = async () => {
    setSwearing(true);
    try {
      const unit = await unitApi("hireling").update(camp.warbandId, line.id, {
        blood_pacted: true,
      });
      updateCache(camp.warbandId, { hirelings: [unit], summaryUnchanged: true });
    } catch (error) {
      toast.error("Couldn't swear the pact.", { description: getErrorMessage(error) });
    } finally {
      setSwearing(false);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-t border-dashed border-line",
        camp.isMobile ? "py-2 pl-6 pr-1.5" : "py-[7px] pl-[22px] pr-1"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 flex-col">
          <span className="text-[13px] font-semibold text-ink">{line.name}</span>
          {line.bonus ? (
            <span className="text-xs text-muted-foreground">+{line.bonus} for advances gained</span>
          ) : null}
        </span>
        <DiceEntry
          dice="2D6"
          size={camp.isMobile ? "md" : "sm"}
          className="shrink-0 flex-nowrap"
          onChange={setFaces}
          onFaces={setFaces}
          button={(roll) => (
            <Button
              size="sm"
              variant="secondary"
              className={camp.isMobile ? "h-10" : "h-9"}
              onClick={roll}
            >
              <Dices aria-hidden="true" />
              2D6
            </Button>
          )}
        />
      </div>
      {total === null ? null : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={cn("text-xs font-bold", sworn ? "text-good" : "text-muted-foreground")}>
            {total}
            {sworn ? " · he swears the pact" : ` · ${PACT_ROLL} forms a pact`}
          </span>
          <Button
            size="sm"
            variant={sworn ? "primary" : "ghost"}
            className={cn(camp.isMobile ? "h-10" : "h-8", "text-xs", sworn ? "" : "opacity-60")}
            disabled={swearing}
            onClick={() => void swear()}
          >
            Form the pact
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Camp's blood pacts (Mutiny in Marienburg, on while the campaign has them on): a 2D6 for each
 * hired sword who could still swear one, rolled here or typed in from the table, and the rule the
 * player reads for the parts the app leaves to him.
 */
export default function BloodPactRows({ camp, lines }: { camp: OpenCamp; lines: PactLine[] }) {
  return (
    <>
      {lines.map((line) => (
        <PactRow key={line.id} camp={camp} line={line} />
      ))}
      <details
        className={cn(
          "border-t border-dashed border-line",
          camp.isMobile ? "py-2 pl-6 pr-1.5" : "py-[7px] pl-[22px] pr-1"
        )}
      >
        <summary className="min-h-6 cursor-pointer text-xs font-semibold text-accent-text">
          Blood Pact
        </summary>
        <div className="mt-1.5 flex flex-col gap-1.5">
          {BLOOD_PACT_RULE.map((paragraph) => (
            <p key={paragraph} className="m-0 text-xs text-text2">
              {paragraph}
            </p>
          ))}
        </div>
      </details>
    </>
  );
}
