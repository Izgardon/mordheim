import type { ButtonVariant } from "../../../types/ui";

export type CampaignSummary = {
  title: string;
  description: string;
  details: string;
  actionLabel: string;
  actionVariant?: ButtonVariant;
};
