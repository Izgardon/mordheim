import type { ReactNode } from "react";

import { CardBackground } from "@/components/ui/card-background";

/** The desktop battle pages' main action, floating bottom right (End Battle, Finalise). */
export default function BattleFloatingActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-4 z-20 px-3 min-[960px]:left-auto min-[960px]:right-4 min-[960px]:inset-x-auto min-[960px]:w-[520px]">
      <CardBackground className="battle-floating-panel space-y-2 p-3">
        <div className="flex flex-wrap justify-end gap-2">{children}</div>
      </CardBackground>
    </div>
  );
}
