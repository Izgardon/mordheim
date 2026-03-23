import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

function resolveEmbedUrl(url: string): string {
  const driveMatch = url.match(/\/file\/d\/([^/?#]+)/)
  if (driveMatch) {
    return `https://drive.google.com/file/d/${driveMatch[1]}/preview`
  }
  return url
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
  title = "Warband PDF",
}: WarbandPdfViewerDialogProps) {
  const embedUrl = resolveEmbedUrl(url)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-[959px]:left-3 max-[959px]:right-3 max-[959px]:!w-auto max-[959px]:rounded-2xl" innerClassName="!p-0 !gap-0">
        <DialogHeader className="px-4 pt-4 pb-2 min-[960px]:px-8 min-[960px]:pt-8">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <iframe
          src={embedUrl}
          style={{ height: "calc(85dvh - 110px)" }}
          className="w-full border-0 min-[960px]:h-[70vh]"
          title={title}
        />
      </DialogContent>
    </Dialog>
  )
}
