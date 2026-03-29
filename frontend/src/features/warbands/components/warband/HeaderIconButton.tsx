import { Tooltip } from "@components/tooltip"
import { Button } from "@components/button"

type HeaderIconButtonProps = {
  icon: string
  label?: string | number
  tooltip: string
  onClick?: () => void
  ariaLabel: string
  iconClassName?: string
}

export default function HeaderIconButton({
  icon,
  label,
  tooltip,
  onClick,
  ariaLabel,
  iconClassName = "h-4 w-4",
}: HeaderIconButtonProps) {
  const content = (
    <>
      <img src={icon} alt="" className={iconClassName} />
      {label !== undefined && label !== "" && <span>{label}</span>}
    </>
  )

  return (
    <Tooltip
      className="inline-flex"
      trigger={
        onClick ? (
          <Button
            type="button"
            variant="toolbar"
            size="sm"
            onClick={onClick}
            className="gap-2"
            aria-label={ariaLabel}
          >
            {content}
          </Button>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-border/70 bg-[#14100c] px-3 py-2" aria-label={ariaLabel}>
            {content}
          </div>
        )
      }
      content={tooltip}
      maxWidth={200}
    />
  )
}
