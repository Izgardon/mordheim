import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/section-title";
import { ReferenceList } from "@/features/reference/ReferenceList";
import { ReferenceRowBones } from "@/features/reference/ReferenceSkeleton";
import { getErrorMessage } from "@/lib/get-error-message";
import { matchesSearchQuery } from "@/lib/matches-search-query";

import { ruleRowKey, ruleRowSub, ruleRowWords, ruleRows } from "../campaign-rule-rows";
import type { useCampaignRuleWrites } from "../hooks/useCampaignRuleWrites";
import { movedIds } from "../hooks/useCampaignRuleWrites";
import type { CampaignRule, CampaignRuleKind, CampaignRulePayload } from "../types/rule-types";
import CampaignRuleFields from "./CampaignRuleFields";
import CampaignRulesModal from "./CampaignRulesModal";
import EditCampaignRuleDialog from "./EditCampaignRuleDialog";
import RuleOpenRow from "./RuleOpenRow";

const BLANK: CampaignRulePayload = { title: "", body: "", umbrella: "" };

/**
 * One list of rules on the Campaign rules page: the campaign's own, or its battle rules (William,
 * 19 Nov 2026: "Battle rules should match design of campaign rules"). Each row opens a modal, and
 * the rules sharing an umbrella are one row that opens them together.
 */
export default function RulesSection({
  title,
  kind,
  rules,
  loading,
  query,
  canManage,
  writes,
  openKey,
  onOpen,
  onClose,
  isMobile,
}: {
  title: string;
  kind: CampaignRuleKind;
  rules: CampaignRule[];
  loading: boolean;
  query: string;
  canManage: boolean;
  writes: ReturnType<typeof useCampaignRuleWrites>;
  /** The row the URL has open, on any of the page's lists. */
  openKey: string | null;
  onOpen: (key: string) => void;
  onClose: () => void;
  isMobile: boolean;
}) {
  const [adding, setAdding] = useState<CampaignRulePayload | null>(null);
  const noun = title.toLowerCase().replace(/s$/, "");
  const [error, setError] = useState("");
  const all = ruleRows(rules, kind);
  const shown = all.filter(
    (row) => row.key === openKey || matchesSearchQuery(query, ...ruleRowWords(row))
  );
  const open = all.find((row) => row.key === openKey) ?? null;
  const ordered = rules.filter((rule) => rule.kind === kind);
  const onError = (fallback: string) => (failure: unknown) =>
    setError(getErrorMessage(failure, fallback));
  const add = () => {
    if (!adding?.title.trim()) return;
    const umbrella = (adding.umbrella ?? "").trim();
    setError("");
    writes.create.mutate(
      { title: adding.title.trim(), body: adding.body.trim(), umbrella, kind },
      {
        onSuccess: (rule) => {
          setAdding(null);
          onOpen(ruleRowKey(rule)); // the row it landed in: its umbrella's, or its own
        },
        onError: onError("Couldn't add the rule."),
      }
    );
  };
  const move = (ruleId: number, by: -1 | 1) =>
    writes.reorder.mutate(movedIds(rules, ruleId, by), {
      onError: onError("Couldn't move the rule."),
    });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>{title}</SectionTitle>
        {canManage && !adding ? (
          <Button size="sm" variant="secondary" onClick={() => setAdding({ ...BLANK })}>
            {isMobile ? "Add" : `Add ${title.toLowerCase().replace(/s$/, "")}`}
          </Button>
        ) : null}
      </div>
      {error ? <p className="m-0 text-sm text-danger">{error}</p> : null}
      {canManage && adding ? (
        <form
          aria-label={`Add ${/^[aeiou]/.test(noun) ? "an" : "a"} ${noun}`}
          className="space-y-3 border border-accent-line bg-surface p-4"
          onSubmit={(event) => {
            event.preventDefault();
            add();
          }}
        >
          <CampaignRuleFields value={adding} onChange={setAdding} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => setAdding(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              type="submit"
              disabled={writes.create.isPending || !adding.title.trim()}
            >
              {writes.create.isPending ? "Saving…" : "Add rule"}
            </Button>
          </div>
        </form>
      ) : null}
      <ReferenceList
        isEmpty={!loading && shown.length === 0}
        empty={all.length ? "Nothing here matches." : `No ${title.toLowerCase()} yet.`}
      >
        {loading ? <ReferenceRowBones /> : null}
        {shown.map((row) => (
          <RuleOpenRow
            key={row.key}
            name={row.name}
            sub={ruleRowSub(row)}
            onOpen={() => onOpen(row.key)}
          />
        ))}
      </ReferenceList>
      <CampaignRulesModal
        row={open}
        kicker={title}
        onClose={onClose}
        actions={
          canManage
            ? (ruleId) => {
                const rule = ordered.find((entry) => entry.id === ruleId);
                const place = rules.findIndex((entry) => entry.id === ruleId);
                if (!rule) return null;
                return (
                  <>
                    <EditCampaignRuleDialog rule={rule} writes={writes} onDeleted={onClose} />
                    <Button
                      variant="ghost"
                      className="min-h-10"
                      disabled={place <= 0 || writes.reorder.isPending}
                      onClick={() => move(ruleId, -1)}
                    >
                      Move up
                    </Button>
                    <Button
                      variant="ghost"
                      className="min-h-10"
                      disabled={place >= rules.length - 1 || writes.reorder.isPending}
                      onClick={() => move(ruleId, 1)}
                    >
                      Move down
                    </Button>
                  </>
                );
              }
            : undefined
        }
      />
    </section>
  );
}
