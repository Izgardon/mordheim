import { Checkbox } from "@components/checkbox";
import { Label } from "@components/label";
import {
  AddNumberField,
  AddRaceField,
  AddTextField,
  type AddFieldsProps,
} from "../../forms/AddFormFields";

import type { NewHeroForm } from "../../../../types/warband-types";

/** Add hero: name, type, race, recruit cost, starting XP and the leader flag. */
export default function HeroAddFields(props: AddFieldsProps<NewHeroForm>) {
  const { form, setForm, setError } = props;
  const setText = (field: "name" | "unit_type") => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  };
  const setNumber = (field: "price" | "xp") => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <AddTextField
          className="min-w-[180px] flex-1 space-y-2"
          label="Name"
          value={form.name}
          onChange={setText("name")}
          placeholder="Hero name"
        />
        <AddTextField
          className="min-w-[160px] flex-1 space-y-2"
          label="Type"
          value={form.unit_type}
          onChange={setText("unit_type")}
          placeholder="Chieftain, Champion"
        />
        <AddRaceField {...props} className="min-w-[200px] flex-[1.2] space-y-2" />
        <AddNumberField
          className="min-w-[140px] flex-1 space-y-2"
          label="Recruit cost"
          value={form.price}
          onChange={setNumber("price")}
          placeholder="0"
        />
        <AddNumberField
          className="min-w-[140px] flex-1 space-y-2"
          label="Experience"
          value={form.xp}
          onChange={setNumber("xp")}
          placeholder="0"
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          checked={form.is_leader}
          onChange={(event) => setForm((prev) => ({ ...prev, is_leader: event.target.checked }))}
        />
        <Label className="text-sm font-semibold text-foreground">Leader</Label>
      </div>
    </>
  );
}
