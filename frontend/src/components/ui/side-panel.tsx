import type { ComponentProps } from "react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Drawer } from "@/components/ui/drawer";
import { useMediaQuery } from "@/lib/use-media-query";

type SidePanelProps = ComponentProps<typeof Drawer>;

/** A drawer from the right on the web, a bottom sheet on a phone (design E): same content. */
export function SidePanel({ actions, ...props }: SidePanelProps) {
  const isMobile = useMediaQuery("(max-width: 960px)");
  return isMobile ? <BottomSheet {...props} /> : <Drawer actions={actions} {...props} />;
}
