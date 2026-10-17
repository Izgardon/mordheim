import { ExternalLink } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMediaQuery } from "@/lib/use-media-query";
import {
  WARBAND_LINK_ALLOW,
  WARBAND_LINK_SANDBOX,
  resolveWarbandLink,
} from "../../utils/warband-link";

type WarbandPdfViewerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  title?: string;
};

/**
 * The warband link: YouTube and Google Drive/Docs open in a sandboxed frame (SEC-14); any
 * other link is offered as a plain link that opens in a new tab.
 */
export default function WarbandPdfViewerDialog({
  open,
  onOpenChange,
  url,
  title = "Warband Link",
}: WarbandPdfViewerDialogProps) {
  const isMobile = useMediaQuery("(max-width: 960px)");
  const link = resolveWarbandLink(url);
  const showDocLink = isMobile && link.isGoogleDoc;
  const externalLinkLabel = showDocLink ? "Open in Google Docs" : "Open link in new tab";
  const externalLink = link.href ? (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-xs text-muted-foreground underline underline-offset-2"
    >
      <ExternalLink className="h-3 w-3" aria-hidden="true" />
      {externalLinkLabel}
    </a>
  ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-6xl max-[959px]:rounded-t-2xl max-[959px]:rounded-b-none"
        innerClassName="!p-0 !gap-0"
      >
        <DialogHeader className="px-4 pt-4 pb-2 min-[960px]:px-8 min-[960px]:pt-8">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {link.embedUrl ? (
          <>
            <div className="bg-white min-[960px]:px-6 min-[960px]:pb-6">
              <iframe
                src={link.embedUrl}
                style={{ height: "calc(85dvh - 110px)" }}
                className="w-full border-0 bg-white min-[960px]:h-[80vh]"
                title={title}
                sandbox={WARBAND_LINK_SANDBOX}
                allow={WARBAND_LINK_ALLOW}
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
            <div className="flex justify-center px-4 pb-3">{externalLink}</div>
          </>
        ) : (
          <div className="space-y-3 px-4 pb-6 min-[960px]:px-8">
            <p className="text-sm text-muted-foreground">
              Only YouTube and Google Drive or Docs links open here.
            </p>
            <p className="break-all text-sm text-foreground">{link.url}</p>
            {externalLink}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
