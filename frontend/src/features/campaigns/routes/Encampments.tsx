import type { CSSProperties } from "react";

// routing
import { useOutletContext } from "react-router-dom";

// components
import { Button } from "@components/button";
import { ConfirmDialog } from "@components/confirm-dialog";
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
      canAdd={page.canAdd}
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
            departedOwner={page.departedOwner}
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
          encampment.capabilities?.edit && page.canAdd ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => page.openEditForm(encampment)}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-8"
                onClick={() => page.requestDelete(encampment)}
              >
                Delete
              </Button>
            </div>
          ) : null
        }
      />
      <ConfirmDialog
        open={Boolean(page.deleting)}
        onOpenChange={(open) => {
          if (!open) page.cancelDelete();
        }}
        title="Delete encampment"
        description={
          <div className="space-y-2">
            <p>{`Delete ${page.deleting?.name ?? "this encampment"}?`}</p>
            <p className="text-xs">It leaves the list for everyone in the campaign.</p>
            {page.deleteError ? <p className="text-sm text-red-600">{page.deleteError}</p> : null}
          </div>
        }
        confirmText={page.isDeleting ? "Deleting..." : "Delete"}
        confirmDisabled={page.isDeleting}
        isConfirming={page.isDeleting}
        onConfirm={() => void page.confirmDelete()}
      />
    </CampaignRecordsPage>
  );
}
