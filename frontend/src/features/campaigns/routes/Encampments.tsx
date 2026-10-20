import type { CSSProperties } from "react";

// routing
import { useOutletContext } from "react-router-dom";

// components
import { Button } from "@components/button";
import CampaignRecordsPage, { RecordForm } from "../components/records/CampaignRecordsPage";
import EncampmentFormFields from "../components/EncampmentFormFields";
import EncampmentsTable from "../components/EncampmentsTable";

// hooks
import { useEncampments } from "../hooks/useEncampments";
import { useMediaQuery } from "@/lib/use-media-query";

// types
import type { CampaignSummary } from "../types/campaign-types";
import type { CampaignLayoutContext } from "./CampaignLayout";

const ENCAMPMENT_ROW_BG_STYLE: CSSProperties = {};

export default function Encampments() {
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  if (!campaign) {
    return <p className="text-sm text-muted-foreground">No record of this campaign.</p>;
  }
  return <EncampmentsPage campaign={campaign} />;
}

function EncampmentsPage({ campaign }: { campaign: CampaignSummary }) {
  const isMobile = useMediaQuery("(max-width: 960px)");
  const page = useEncampments(campaign);

  return (
    <CampaignRecordsPage
      campaign={campaign}
      section="encampments"
      title="Encampments"
      subtitle="Shared camps and ownership records"
      heading="Campaign Encampments"
      isEnabled={page.isEnabled}
      disabledMessage="Encampments are currently disabled for this campaign. The campaign owner can enable them in Campaign Settings."
      addLabel="Add encampment"
      canAdd={page.canManage}
      isFormOpen={page.isFormOpen}
      onOpenForm={page.openCreateForm}
      onCloseForm={page.closeForm}
      formRef={page.formRef}
      form={
        <RecordForm
          error={page.formError}
          isSubmitting={page.isSubmitting}
          isEditing={Boolean(page.editing)}
          onCancel={page.closeForm}
          onSubmit={page.submit}
        >
          <EncampmentFormFields
            form={page.form}
            setForm={page.setForm}
            ownerValue={page.ownerValue}
            onOwnerChange={page.chooseOwner}
            players={page.players}
          />
        </RecordForm>
      }
      isLoading={page.isLoading}
      error={page.error}
      isEmpty={page.encampments.length === 0}
      emptyMessage="No encampments created yet."
      skeletonColumns={4}
    >
      <EncampmentsTable
        encampments={page.encampments}
        rowBackground={ENCAMPMENT_ROW_BG_STYLE}
        isMobile={isMobile}
        renderActions={(encampment) =>
          page.canManage ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => page.openEditForm(encampment)}
            >
              Edit
            </Button>
          ) : null
        }
      />
    </CampaignRecordsPage>
  );
}
