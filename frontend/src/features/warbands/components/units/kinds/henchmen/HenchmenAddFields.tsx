import {
  AddNumberField,
  AddRaceField,
  AddTextField,
  type AddFieldsProps,
} from "../../forms/AddFormFields";

import type { NewHenchmenGroupForm } from "../../../../types/warband-types";

/** Add group: name, type, race, the first henchman, max size (default 5) and base cost. */
export default function HenchmenAddFields(props: AddFieldsProps<NewHenchmenGroupForm>) {
  const { form, setForm, setError } = props;
  const setText = (field: "name" | "unit_type" | "firstHenchmanName") => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  };
  const setNumber = (field: "max_size" | "price") => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="grid grid-cols-2 gap-3 min-[960px]:grid-cols-12">
      <AddTextField
        className="col-span-2 space-y-2 min-[960px]:col-span-2"
        label="Group name"
        value={form.name}
        onChange={setText("name")}
        placeholder="Group name"
      />
      <AddTextField
        className="col-span-2 space-y-2 min-[960px]:col-span-2"
        label="Type"
        value={form.unit_type}
        onChange={setText("unit_type")}
        placeholder="Swordsmen, Verminkin"
      />
      <AddRaceField {...props} className="col-span-1 space-y-2 min-[960px]:col-span-3" />
      <AddTextField
        className="col-span-1 space-y-2 min-[960px]:col-span-2"
        label="First henchman"
        value={form.firstHenchmanName}
        onChange={setText("firstHenchmanName")}
        placeholder="Henchman name"
      />
      <AddNumberField
        className="col-span-1 space-y-2 min-[960px]:col-span-1"
        label="Max size"
        value={form.max_size}
        onChange={setNumber("max_size")}
        placeholder="5"
        min={1}
      />
      <AddNumberField
        className="col-span-1 space-y-2 min-[960px]:col-span-1"
        label="Base cost"
        value={form.price}
        onChange={setNumber("price")}
        placeholder="0"
      />
    </div>
  );
}
