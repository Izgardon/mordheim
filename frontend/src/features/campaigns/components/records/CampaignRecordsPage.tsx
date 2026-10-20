import { useMemo } from "react";
import type { ReactNode, RefObject } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@components/button";
import { CardBackground } from "@components/card-background";
import MobileTabs from "@components/mobile-tabs";
import { PageHeader } from "@components/page-header";
import { TableSkeleton } from "@components/table-skeleton";
import { useMediaQuery } from "@/lib/use-media-query";
import { getCampaignSectionTabs, type CampaignSectionTabId } from "@/lib/campaign-section-tabs";

import type { CampaignSummary } from "../../types/campaign-types";

type CampaignRecordsPageProps = {
  campaign: CampaignSummary;
  /** The section tab this page is (the phone's section tabs mark it). */
  section: CampaignSectionTabId;
  title: string;
  subtitle: string;
  /** The list's heading, beside Add. */
  heading: string;
  isEnabled: boolean;
  disabledMessage: string;
  addLabel: string;
  canAdd: boolean;
  isFormOpen: boolean;
  onOpenForm: () => void;
  onCloseForm: () => void;
  formRef: RefObject<HTMLDivElement>;
  /** The open form (a `RecordForm`). */
  form: ReactNode;
  isLoading: boolean;
  error: string;
  isEmpty: boolean;
  emptyMessage: string;
  skeletonColumns: number;
  /** The table of records. */
  children: ReactNode;
};

/**
 * The scaffold of a campaign records page (Encampments; Locations can follow): header, the
 * phone's section tabs, the switched-off notice, the heading with Add, the form and the list's
 * loading, error and empty states.
 */
export default function CampaignRecordsPage(props: CampaignRecordsPageProps) {
  const { campaign, section, isEnabled } = props;
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const sectionTabs = useMemo(() => getCampaignSectionTabs(campaign), [campaign]);

  return (
    <div className="min-h-0 space-y-4 sm:space-y-6">
      <PageHeader title={props.title} subtitle={props.subtitle} />

      {isMobile ? (
        <MobileTabs
          tabs={sectionTabs}
          activeTab={section}
          onTabChange={(tabId) => navigate(`/campaigns/${campaign.id}/${tabId}`)}
          className="mt-2"
          showDivider
        />
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-2 sm:gap-4 sm:px-0">
        {!isEnabled ? (
          <CardBackground className="rounded-2xl p-5">
            <p className="text-sm text-muted-foreground">{props.disabledMessage}</p>
          </CardBackground>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="theme-heading-soft text-xl font-bold">{props.heading}</h3>
              </div>
              {props.canAdd ? (
                <Button
                  size="sm"
                  className="md:h-11"
                  onClick={props.isFormOpen ? props.onCloseForm : props.onOpenForm}
                >
                  {props.isFormOpen ? "Close" : props.addLabel}
                </Button>
              ) : null}
            </div>

            {props.isFormOpen ? <div ref={props.formRef}>{props.form}</div> : null}

            <div className="flex flex-1 min-h-0 flex-col">
              {props.isLoading ? (
                <TableSkeleton columns={props.skeletonColumns} rows={10} />
              ) : props.error ? (
                <p className="text-sm text-red-600">{props.error}</p>
              ) : props.isEmpty ? (
                <CardBackground className="rounded-2xl p-5">
                  <p className="text-sm text-muted-foreground">{props.emptyMessage}</p>
                </CardBackground>
              ) : (
                props.children
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

type RecordFormProps = {
  /** The fields, laid out in the form's two-column grid. */
  children: ReactNode;
  error: string;
  isSubmitting: boolean;
  isEditing: boolean;
  onCancel: () => void;
  onSubmit: () => void;
};

/** A record's add or edit form: its fields, its error, Cancel and Save. */
export function RecordForm({
  children,
  error,
  isSubmitting,
  isEditing,
  onCancel,
  onSubmit,
}: RecordFormProps) {
  return (
    <div className="space-y-3 border border-border/60 bg-background/80 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : isEditing ? "Save changes" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
