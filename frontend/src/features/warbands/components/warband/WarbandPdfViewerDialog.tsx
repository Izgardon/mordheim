import { ExternalLink } from "lucide-react"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useMediaQuery } from "@/lib/use-media-query"
import { normalizeWebUrl } from "@/lib/url-utils"

function resolveEmbedUrl(url: string): string {
  const normalizedUrl = normalizeWebUrl(url)
  const driveMatch = normalizedUrl.match(/\/file\/d\/([^/?#]+)/)
  if (driveMatch) {
    return `https://drive.google.com/file/d/${driveMatch[1]}/preview`
  }
  const docsMatch = normalizedUrl.match(/docs\.google\.com\/document\/d\/([^/?#]+)/)
  if (docsMatch) {
    const tab = (() => { try { return new URL(normalizedUrl).searchParams.get("tab") } catch { return null } })()
    const tabParam = tab ? `?tab=${tab}` : ""
    return `https://docs.google.com/document/d/${docsMatch[1]}/preview${tabParam}`
  }
  return normalizedUrl
}

function isGoogleDoc(url: string): boolean {
  return /docs\.google\.com\/document\/d\//.test(url)
}

type WarbandPdfViewerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  url: string
  title?: string
}

export default function WarbandPdfViewerDialog({
  open,
  onOpenChange,
  url,
  title = "Warband Link",
}: WarbandPdfViewerDialogProps) {
  const isMobile = useMediaQuery("(max-width: 960px)")
  const normalizedUrl = normalizeWebUrl(url)
  const embedUrl = resolveEmbedUrl(normalizedUrl)
  const showDocLink = isMobile && isGoogleDoc(normalizedUrl)
  const externalLinkLabel = showDocLink ? "Open in Google Docs" : "Open link in new tab"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-[959px]:rounded-t-2xl max-[959px]:rounded-b-none" innerClassName="!p-0 !gap-0">
        <DialogHeader className="px-4 pt-4 pb-2 min-[960px]:px-8 min-[960px]:pt-8">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="bg-white min-[960px]:px-6 min-[960px]:pb-6">
          <iframe
            src={embedUrl}
            style={{ height: "calc(85dvh - 110px)" }}
            className="w-full border-0 bg-white min-[960px]:h-[80vh]"
            title={title}
            allow="fullscreen; autoplay; clipboard-read; clipboard-write"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        <div className="flex justify-center px-4 pb-3">
          <a
            href={normalizedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs text-muted-foreground underline underline-offset-2"
          >
            <ExternalLink className="h-3 w-3" />
            {externalLinkLabel}
          </a>
        </div>
      </DialogContent>
    </Dialog>
  )
}
