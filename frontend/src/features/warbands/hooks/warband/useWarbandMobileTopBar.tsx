import { useCallback, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Check, Loader2, X } from "lucide-react";

export type MobileEditSection = "heroes" | "henchmen" | "hiredswords";

export type MobileEditState = {
  section: MobileEditSection;
  onSave?: () => void;
  onCancel?: () => void;
  isSaving?: boolean;
};

type MobileTopBarConfig = {
  title: string;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
};

type UseWarbandMobileTopBarParams = {
  isMobile: boolean;
  isEditing: boolean;
  isSaving: boolean;
  handleSaveChanges: () => void;
  cancelEditing: () => void;
  setMobileTopBar?: (config: Partial<MobileTopBarConfig>) => void;
  warbandName: string | undefined;
};

type UseWarbandMobileTopBarReturn = {
  mobileEditState: MobileEditState | null;
  setMobileEditState: Dispatch<SetStateAction<MobileEditState | null>>;
  handleMobileEditChange: (
    section: MobileEditSection,
    state: { isEditing: boolean; onSave?: () => void; onCancel?: () => void; isSaving?: boolean }
  ) => void;
  isMobileEditing: boolean;
};

export function useWarbandMobileTopBar({
  isMobile,
  isEditing,
  isSaving,
  handleSaveChanges,
  cancelEditing,
  setMobileTopBar,
  warbandName,
}: UseWarbandMobileTopBarParams): UseWarbandMobileTopBarReturn {
  const [mobileEditState, setMobileEditState] = useState<MobileEditState | null>(null);

  const handleMobileEditChange = useCallback(
    (
      section: MobileEditSection,
      state: { isEditing: boolean; onSave?: () => void; onCancel?: () => void; isSaving?: boolean }
    ) => {
      if (!isMobile) {
        return;
      }
      if (state.isEditing) {
        setMobileEditState({
          section,
          onSave: state.onSave,
          onCancel: state.onCancel,
          isSaving: state.isSaving,
        });
      } else {
        setMobileEditState((prev) => (prev?.section === section ? null : prev));
      }
    },
    [isMobile]
  );

  // Sync hero editing state into mobileEditState
  useEffect(() => {
    if (!isMobile) {
      setMobileEditState((prev) => (prev?.section === "heroes" ? null : prev));
      return;
    }
    if (isEditing) {
      setMobileEditState({
        section: "heroes",
        onSave: handleSaveChanges,
        onCancel: cancelEditing,
        isSaving,
      });
    } else {
      setMobileEditState((prev) => (prev?.section === "heroes" ? null : prev));
    }
  }, [cancelEditing, handleSaveChanges, isEditing, isMobile, isSaving]);

  // Update the mobile top bar based on edit state
  useEffect(() => {
    if (!isMobile || !setMobileTopBar) {
      return;
    }

    if (mobileEditState) {
      const editTitle = (() => {
        switch (mobileEditState.section) {
          case "heroes":
            return "Editing Heroes";
          case "henchmen":
            return "Editing Henchmen";
          case "hiredswords":
            return "Editing Hired Swords";
          default:
            return "Editing";
        }
      })();

      setMobileTopBar({
        title: editTitle,
        leftSlot: null,
        rightSlot: (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={mobileEditState.onCancel}
              disabled={!mobileEditState.onCancel}
              className="icon-button flex h-9 w-9 items-center justify-center border-none bg-transparent p-0 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Cancel edits"
            >
              <X className="h-5 w-5 text-[#e9dcc2]" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={mobileEditState.onSave}
              disabled={!mobileEditState.onSave || mobileEditState.isSaving}
              className="icon-button flex h-9 w-9 items-center justify-center border-none bg-transparent p-0 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Save edits"
            >
              {mobileEditState.isSaving ? (
                <Loader2 className="h-5 w-5 animate-spin text-[#e9dcc2]" aria-hidden="true" />
              ) : (
                <Check className="h-5 w-5 text-[#e9dcc2]" aria-hidden="true" />
              )}
            </button>
          </div>
        ),
      });
      return;
    }

    setMobileTopBar({ title: warbandName ?? "Warband" });
  }, [isMobile, mobileEditState, setMobileTopBar, warbandName]);

  return {
    mobileEditState,
    setMobileEditState,
    handleMobileEditChange,
    isMobileEditing: isMobile && Boolean(mobileEditState),
  };
}
