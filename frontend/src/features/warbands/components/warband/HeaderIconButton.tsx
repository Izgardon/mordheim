import { Tooltip } from "@components/tooltip"

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
          <button
            type="button"
            onClick={onClick}
            className="flex cursor-pointer items-center gap-2 border-none bg-transparent p-0 font-semibold text-inherit transition-[filter] hover:brightness-150"
            aria-label={ariaLabel}
          >
            {content}
          </button>
        ) : (
          <div className="flex items-center gap-2" aria-label={ariaLabel}>
            {content}
          </div>
        )
      }
      content={tooltip}
      maxWidth={200}
    />
  )
}
