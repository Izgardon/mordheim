import { Tooltip } from "@components/tooltip"
import { Button } from "@components/button"

type HeaderIconButtonProps = {
  icon: string
  label?: string | number
  tooltip: string
  onClick?: () => void
  ariaLabel: string
  iconClassName?: string
  buttonClassName?: string
}

export default function HeaderIconButton({
  icon,
  label,
  tooltip,
  onClick,
  ariaLabel,
  iconClassName = "h-4 w-4",
  buttonClassName: buttonClassNameProp,
}: HeaderIconButtonProps) {
  const buttonClassName =
    `h-9 w-[5.5rem] justify-start gap-2 px-3 text-xs tabular-nums${buttonClassNameProp ? ` ${buttonClassNameProp}` : ""}`
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
            size={undefined}
            onClick={onClick}
            className={buttonClassName}
            aria-label={ariaLabel}
          >
            {content}
          </Button>
        ) : (
          <div
            className={`btn-toolbar inline-flex items-center ${buttonClassName}`}
            aria-label={ariaLabel}
          >
            {content}
          </div>
        )
      }
      content={tooltip}
      maxWidth={200}
    />
  )
}
