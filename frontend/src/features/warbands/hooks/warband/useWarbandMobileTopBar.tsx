import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { Check, ChevronDown, Loader2, X } from "lucide-react";

export type MobileEditSection = "heroes" | "henchmen" | "hiredswords";

export type MobileEditNavigationItem = {
  value: string;
  label: string;
  elementId: string;
};

export type MobileEditState = {
  section: MobileEditSection;
  onSave?: () => void;
  onCancel?: () => void;
  isSaving?: boolean;
  navigationItems?: MobileEditNavigationItem[];
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
  hasRejoinButton?: boolean;
  heroEditNavigationItems?: MobileEditNavigationItem[];
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
  hasRejoinButton,
  heroEditNavigationItems = [],
}: UseWarbandMobileTopBarParams): UseWarbandMobileTopBarReturn {
  const [mobileEditState, setMobileEditState] = useState<MobileEditState | null>(null);
  const [selectedNavigationValue, setSelectedNavigationValue] = useState("");
  const previousSectionRef = useRef<MobileEditSection | null>(null);

  const scrollToNavigationItem = useCallback((item: MobileEditNavigationItem | undefined) => {
    if (!item) {
      return;
    }
    const element = document.getElementById(item.elementId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const handleMobileEditChange = useCallback(
    (
      section: MobileEditSection,
      state: {
        isEditing: boolean;
        onSave?: () => void;
        onCancel?: () => void;
        isSaving?: boolean;
        navigationItems?: MobileEditNavigationItem[];
      }
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
          navigationItems: state.navigationItems ?? [],
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
        navigationItems: heroEditNavigationItems,
      });
    } else {
      setMobileEditState((prev) => (prev?.section === "heroes" ? null : prev));
    }
  }, [cancelEditing, handleSaveChanges, heroEditNavigationItems, isEditing, isMobile, isSaving]);

  useEffect(() => {
    if (!mobileEditState) {
      previousSectionRef.current = null;
      setSelectedNavigationValue("");
      return;
    }

    const navigationItems = mobileEditState.navigationItems ?? [];
    if (navigationItems.length === 0) {
      previousSectionRef.current = mobileEditState.section;
      setSelectedNavigationValue("");
      return;
    }

    const sectionChanged = previousSectionRef.current !== mobileEditState.section;
    previousSectionRef.current = mobileEditState.section;

    setSelectedNavigationValue((current) => {
      if (
        !sectionChanged &&
        current &&
        navigationItems.some((item) => item.value === current)
      ) {
        return current;
      }
      return navigationItems[0].value;
    });
  }, [mobileEditState]);

  const handleNavigationChange = useCallback(
    (nextValue: string) => {
      if (!mobileEditState) {
        return;
      }
      setSelectedNavigationValue(nextValue);
      scrollToNavigationItem(
        mobileEditState.navigationItems?.find((item) => item.value === nextValue)
      );
    },
    [mobileEditState, scrollToNavigationItem]
  );

  useEffect(() => {
    const navigationItems = mobileEditState?.navigationItems ?? [];
    if (!isMobile || !mobileEditState || navigationItems.length === 0) {
      return;
    }

    const topOffset = 108;
    let frameHandle = 0;

    const syncSelectedFromScroll = () => {
      frameHandle = 0;

      let nextValue: string | null = null;
      let bestPassedTop = Number.NEGATIVE_INFINITY;

      for (const item of navigationItems) {
        const element = document.getElementById(item.elementId);
        if (!element) {
          continue;
        }
        const top = element.getBoundingClientRect().top - topOffset;
        if (top <= 0 && top > bestPassedTop) {
          bestPassedTop = top;
          nextValue = item.value;
        }
      }

      if (!nextValue) {
        let nearestAboveFold = Number.POSITIVE_INFINITY;
        for (const item of navigationItems) {
          const element = document.getElementById(item.elementId);
          if (!element) {
            continue;
          }
          const top = element.getBoundingClientRect().top - topOffset;
          if (top >= 0 && top < nearestAboveFold) {
            nearestAboveFold = top;
            nextValue = item.value;
          }
        }
      }

      if (!nextValue) {
        nextValue = navigationItems[0].value;
      }

      setSelectedNavigationValue((current) => (current === nextValue ? current : nextValue));
    };

    const onScroll = () => {
      if (frameHandle !== 0) {
        return;
      }
      frameHandle = window.requestAnimationFrame(syncSelectedFromScroll);
    };

    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      if (frameHandle !== 0) {
        window.cancelAnimationFrame(frameHandle);
      }
    };
  }, [isMobile, mobileEditState]);

  // Update the mobile top bar based on edit state
  useEffect(() => {
    if (!isMobile || !setMobileTopBar) {
      return;
    }

    if (mobileEditState) {
      const editTitle = (() => {
        switch (mobileEditState.section) {
          case "heroes":
            return "Heroes:";
          case "henchmen":
            return "Henchmen:";
          case "hiredswords":
            return "Hired Swords:";
          default:
            return "Warband:";
        }
      })();
      const navigationItems = mobileEditState.navigationItems ?? [];

      setMobileTopBar({
        title: editTitle,
        leftSlot: null,
        centerSlot:
          navigationItems.length > 0 ? (
            <div className="relative max-w-[11rem] min-w-[8rem]">
              <select
                value={selectedNavigationValue}
                onChange={(event) => handleNavigationChange(event.target.value)}
                className="h-9 w-full appearance-none rounded-sm border border-[#4c3a2a] bg-[#0f0c09] pl-3 pr-8 text-xs font-semibold text-[color:var(--color-icon-strong)]"
                aria-label={`${editTitle} navigation`}
              >
                {navigationItems.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--color-icon-soft)]" />
            </div>
          ) : null,
        rightSlot: (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={mobileEditState.onCancel}
              disabled={!mobileEditState.onCancel}
              className="icon-button flex h-9 w-9 items-center justify-center border-none bg-transparent p-0 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Cancel edits"
            >
              <X className="theme-icon-soft h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={mobileEditState.onSave}
              disabled={!mobileEditState.onSave || mobileEditState.isSaving}
              className="icon-button flex h-9 w-9 items-center justify-center border-none bg-transparent p-0 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Save edits"
            >
              {mobileEditState.isSaving ? (
                <Loader2 className="theme-icon-soft h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="theme-icon-soft h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        ),
      });
      return;
    }

    setMobileTopBar({ title: hasRejoinButton ? "Warband" : (warbandName ?? "Warband") });
  }, [
    handleNavigationChange,
    hasRejoinButton,
    isMobile,
    mobileEditState,
    selectedNavigationValue,
    setMobileTopBar,
    warbandName,
  ]);

  return {
    mobileEditState,
    setMobileEditState,
    handleMobileEditChange,
    isMobileEditing: isMobile && Boolean(mobileEditState),
  };
}

export function getWarbandMobileEditItemId(section: MobileEditSection, value: string) {
  return `warband-mobile-edit-${section}-${value}`;
}
