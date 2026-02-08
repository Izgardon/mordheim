import { Input } from "@components/input";
import { Label } from "@components/label";

import type { WarbandUpdatePayload } from "../../types/warband-types";

type WarbandEditFormProps = {
  warbandForm: WarbandUpdatePayload;
  onChange: (payload: WarbandUpdatePayload) => void;
};

export default function WarbandEditForm({ warbandForm, onChange }: WarbandEditFormProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground">Edit warband</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground">Warband name</Label>
          <Input
            value={warbandForm.name}
            onChange={(event) =>
              onChange({
                ...warbandForm,
                name: event.target.value,
              })
            }
            placeholder="Warband name"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground">Faction</Label>
          <Input
            value={warbandForm.faction}
            onChange={(event) =>
              onChange({
                ...warbandForm,
                faction: event.target.value,
              })
            }
            placeholder="Faction"
          />
        </div>
      </div>
    </div>
  );
}


