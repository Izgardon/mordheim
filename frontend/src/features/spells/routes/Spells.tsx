import { useMemo } from "react";
import { useOutletContext, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useSettingsById } from "@/features/campaigns/api/settings-queries";
import { campaignCapabilities } from "@/features/campaigns/capabilities";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import { entrySettingName, inPlayOnly } from "@/features/reference/in-play";
import ReferencePage from "@/features/reference/ReferencePage";
import { ReferenceRowBones } from "@/features/reference/ReferenceSkeleton";
import { FilterRow, ReferenceSearch } from "@/features/reference/ReferenceFilters";
import { ReferenceList, ReferenceRow } from "@/features/reference/ReferenceList";
import { useReferenceParams } from "@/features/reference/useReferenceParams";
import { useCatalogue } from "@/lib/catalogue-queries";
import { useMediaQuery } from "@/lib/use-media-query";

import LoreSpells from "../components/LoreSpells";
import SpellFormDialog from "../components/SpellFormDialog";
import { loreOf, loreRowId, spellLores, type SpellLore } from "../spell-lores";

const counted = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

/**
 * Spells (design E's reference layout): a row per lore in play in the campaign, opening across
 * the list's width to its spells' settings and its D6 table; a spell's row opens to its rules.
 * The search (name, lore or rules) keeps the lores with a match, each with only its matches.
 * `?lore=` opens a lore, `?open=` a spell in its lore (Search everything's links). Custom spells
 * are added and edited as before.
 */
export default function Spells() {
  const { id } = useParams();
  const campaignId = Number(id);
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const spells = useCatalogue("spells", campaignId);
  const settings = useSettingsById();
  const params = useReferenceParams(!spells.isLoading);
  const capabilities = campaignCapabilities(campaign);

  const inPlay = useMemo(() => inPlayOnly(spells.data), [spells.data]);
  const lores = spellLores(inPlay, params.query, params.openId);
  const types = useMemo(
    () => [...new Set(inPlay.map((spell) => spell.type ?? "").filter(Boolean))].sort(),
    [inPlay]
  );
  const openSpell = inPlay.find((spell) => String(spell.id) === params.openId);
  const openLore = openSpell ? loreOf(openSpell) : params.get("lore") || null;
  const searching = Boolean(params.query.trim());
  const matches = lores.reduce((sum, lore) => sum + lore.matches, 0);

  const toggleLore = (name: string) =>
    params.set(openLore === name ? { lore: null, open: null } : { lore: name, open: null });
  // a spell's lore stays open when its rules close
  const closeSpell = (lore: string) => params.set({ open: null, lore });
  const pickSpell = (lore: string, spellId: string) =>
    params.isOpen(spellId) ? closeSpell(lore) : params.set({ open: spellId, lore: null });

  // its spells' settings, named in its open row (William, 7 Nov 2026: "others should exist in the
  // expanded part")
  const loreSettings = (lore: SpellLore) => [
    ...new Set(lore.spells.map((spell) => entrySettingName(spell, settings))),
  ];

  const addButton = capabilities.edit_catalogue ? (
    <SpellFormDialog
      campaignId={campaignId}
      typeOptions={types}
      onSaved={(spell) => params.reveal(String(spell.id), { q: null, lore: null })}
      trigger={
        <Button variant="secondary" className={isMobile ? "min-h-10" : undefined}>
          Add spell
        </Button>
      }
    />
  ) : null;

  return (
    <ReferencePage
      title="Spells"
      section="spells"
      archived={{
        kind: "spells",
        campaignId,
        canRestore: capabilities.edit_catalogue,
        noun: "spells",
      }}
      actions={addButton}
      filters={
        <FilterRow isMobile={isMobile}>
          <ReferenceSearch
            value={params.query}
            onChange={params.setQuery}
            placeholder="Search spells"
            label="Search spells"
            isMobile={isMobile}
          />
        </FilterRow>
      }
      summary={
        isMobile
          ? undefined
          : searching
            ? `${counted(matches, "spell")} in ${counted(lores.length, "lore")}`
            : `${counted(lores.length, "lore")}, ${counted(matches, "spell")}`
      }
    >
      {spells.error ? <p className="m-0 text-sm text-danger">{spells.error}</p> : null}
      <ReferenceList
        nameLabel="Lore"
        // William, 7 Nov 2026: "Spells - drop spells and difficulty column"
        columns={isMobile ? undefined : []}
        isEmpty={!spells.isLoading && lores.length === 0}
        empty="No spells match."
      >
        {spells.isLoading ? <ReferenceRowBones cells={0} /> : null}
        {lores.map((lore) => (
          <ReferenceRow
            key={lore.name}
            id={loreRowId(lore.name)}
            open={openLore === lore.name}
            onToggle={() => toggleLore(lore.name)}
            name={lore.name}
            cells={isMobile ? undefined : []}
          >
            <LoreSpells
              campaignId={campaignId}
              lore={lore}
              settingNames={loreSettings(lore)}
              openId={params.openId}
              onPick={(spellId) => pickSpell(lore.name, spellId)}
              onClose={() => closeSpell(lore.name)}
              edit={
                capabilities.edit_catalogue
                  ? {
                      typeOptions: types,
                      canDelete: capabilities.delete_catalogue,
                      onSaved: (saved) => params.reveal(String(saved.id), { lore: null }),
                      onDeleted: () => closeSpell(lore.name),
                    }
                  : null
              }
              isMobile={isMobile}
            />
          </ReferenceRow>
        ))}
      </ReferenceList>
    </ReferencePage>
  );
}
