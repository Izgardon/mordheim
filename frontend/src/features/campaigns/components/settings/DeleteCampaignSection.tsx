import { useNavigate } from "react-router-dom";

// components
import DeleteCampaignCard from "./DeleteCampaignCard";

// hooks
import { useDeleteCampaign } from "../../hooks/settings/useDeleteCampaign";

/** The owner's delete card (`capabilities.delete`); a deleted campaign leaves for the list. */
export default function DeleteCampaignSection({ campaignId }: { campaignId: number }) {
  const navigate = useNavigate();
  const deletion = useDeleteCampaign(campaignId, () => navigate("/campaigns"));
  return (
    <DeleteCampaignCard
      open={deletion.deleteOpen}
      onOpenChange={deletion.setDeleteOpen}
      onReset={deletion.resetDeleteState}
      deleteValue={deletion.deleteValue}
      onDeleteValueChange={deletion.setDeleteValue}
      isDeleteReady={deletion.isDeleteReady}
      deleteError={deletion.deleteError}
      isDeleting={deletion.isDeleting}
      onDelete={deletion.handleDeleteCampaign}
    />
  );
}
