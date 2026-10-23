import scull2Icon from "@/assets/icons/Scull2.webp";

/** The skull over a unit out of action; yours brings it back in action. */
export default function ActiveOutOfActionOverlay({
  name,
  canInteract,
  disabled,
  onBackInAction,
}: {
  name: string;
  canInteract: boolean;
  disabled: boolean;
  onBackInAction: () => void;
}) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/65">
      {canInteract ? (
        <button
          type="button"
          className="icon-button flex h-14 w-14 items-center justify-center rounded-full border-none bg-transparent text-[#d6c8aa] shadow-none transition hover:bg-transparent hover:text-foreground"
          onClick={onBackInAction}
          disabled={disabled}
          aria-label={`Set ${name} back in action`}
        >
          <img src={scull2Icon} alt="" className="h-10 w-10 object-contain" />
        </button>
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-transparent text-[#d6c8aa]">
          <img src={scull2Icon} alt="" className="h-10 w-10 object-contain" />
        </div>
      )}
    </div>
  );
}
