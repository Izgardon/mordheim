import type { ReactNode } from "react";

import { PageSubnav } from "@/components/ui/page-subnav";
import type { BattleParticipant } from "@/features/battles/types/battle-types";

type BattleDesktopSubnavProps = {
  title: string;
  subtitle?: string;
  participants: BattleParticipant[];
  selectedParticipantUserId: number | null;
  onSelectParticipant: (participantUserId: number) => void;
  actions?: ReactNode;
};

export default function BattleDesktopSubnav({
  title,
  subtitle,
  participants,
  selectedParticipantUserId,
  onSelectParticipant,
  actions,
}: BattleDesktopSubnavProps) {
  const tabs = participants.map((participant) => ({
    id: String(participant.user.id),
    label: participant.warband.name,
  }));
  const activeTab =
    selectedParticipantUserId !== null
      ? String(selectedParticipantUserId)
      : participants[0]
        ? String(participants[0].user.id)
        : undefined;

  return (
    <PageSubnav
      title={title}
      subtitle={subtitle}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(participantUserId) => onSelectParticipant(Number(participantUserId))}
      actions={actions}
    />
  );
}
