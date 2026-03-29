import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { CardBackground } from "@/components/ui/card-background";
import exitIcon from "@/assets/components/exit.webp";
import DetailCardContent from "./DetailCardContent";
import type { DetailEntry, PopupPosition } from "./detail-types";

export type { DetailEntry, PopupPosition } from "./detail-types";

type DetailPopupProps = {
  entry: DetailEntry;
  onClose: () => void;
  anchorRect?: DOMRect | null;
  stackIndex?: number;
  existingPositions?: PopupPosition[];
  onPositionCalculated?: (position: PopupPosition) => void;
};

type PopupRenderPosition = {
  left: number;
  top: number;
  bottom?: number;
};

const POPUP_WIDTH = 320;
const POPUP_HEIGHT_ESTIMATE = 300;
const POPUP_GAP = 12;
const POPUP_PADDING = 16;
const MOBILE_BREAKPOINT = 768;
const MOBILE_SIDE_HYSTERESIS = 32;

type MobileVerticalSide = "top" | "bottom";

function chooseMobileVerticalSide(
  anchorRect: DOMRect,
  popupHeight: number,
  preferredSide: MobileVerticalSide | null
): MobileVerticalSide {
  const viewportHeight = window.innerHeight;
  const clampedHeight = Math.min(popupHeight, viewportHeight - POPUP_PADDING * 2);
  const spaceAbove = Math.max(0, anchorRect.top - POPUP_PADDING - POPUP_GAP);
  const spaceBelow = Math.max(
    0,
    viewportHeight - anchorRect.bottom - POPUP_PADDING - POPUP_GAP
  );
  const fitsAbove = spaceAbove >= clampedHeight;
  const fitsBelow = spaceBelow >= clampedHeight;

  if (preferredSide === "bottom") {
    if (fitsBelow || (!fitsAbove && spaceBelow + MOBILE_SIDE_HYSTERESIS >= spaceAbove)) {
      return "bottom";
    }
    return "top";
  }

  if (preferredSide === "top") {
    if (fitsAbove || (!fitsBelow && spaceAbove + MOBILE_SIDE_HYSTERESIS >= spaceBelow)) {
      return "top";
    }
    return "bottom";
  }

  if (fitsBelow) {
    return "bottom";
  }
  if (fitsAbove) {
    return "top";
  }
  return spaceBelow >= spaceAbove ? "bottom" : "top";
}

function calculatePopupPosition(
  anchorRect: DOMRect,
  existingPositions: PopupPosition[],
  popupWidth: number,
  popupHeight: number,
  isMobile: boolean,
  preferredMobileSide: MobileVerticalSide | null = null
): PopupRenderPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const clampedHeight = Math.min(popupHeight, viewportHeight - POPUP_PADDING * 2);

  if (isMobile) {
    const triggerCenter = anchorRect.left + anchorRect.width / 2;
    const left = Math.max(
      POPUP_PADDING,
      Math.min(triggerCenter - popupWidth / 2, viewportWidth - POPUP_PADDING - popupWidth)
    );
    const mobileSide = chooseMobileVerticalSide(
      anchorRect,
      clampedHeight,
      preferredMobileSide
    );
    if (mobileSide === "bottom") {
      const top = anchorRect.bottom + POPUP_GAP;
      return {
        top: Math.max(
          POPUP_PADDING,
          Math.min(top, viewportHeight - POPUP_PADDING - clampedHeight)
        ),
        left,
      };
    }

    const bottom = viewportHeight - anchorRect.top + POPUP_GAP;
    const resolvedTop = viewportHeight - bottom - clampedHeight;
    if (resolvedTop >= POPUP_PADDING) {
      return {
        top: resolvedTop,
        left,
        bottom,
      };
    }

    return {
      top: Math.max(
        POPUP_PADDING,
        Math.min(anchorRect.top - POPUP_GAP - clampedHeight, viewportHeight - POPUP_PADDING - clampedHeight)
      ),
      left,
    };
  }

  const maxHeight = viewportHeight - POPUP_PADDING * 2;

  // Try right side first
  let left = anchorRect.right + POPUP_GAP;
  if (left + popupWidth > viewportWidth - POPUP_PADDING) {
    left = anchorRect.left - popupWidth - POPUP_GAP;
  }
  left = Math.max(
    POPUP_PADDING,
    Math.min(left, viewportWidth - popupWidth - POPUP_PADDING)
  );

  let top = anchorRect.top;
  top = Math.max(
    POPUP_PADDING,
    Math.min(top, viewportHeight - clampedHeight - POPUP_PADDING)
  );

  // Check for overlaps and adjust
  const checkOverlap = (t: number, l: number) => {
    return existingPositions.some((pos) => {
      const noOverlap =
        l + popupWidth < pos.left ||
        l > pos.left + pos.width ||
        t + clampedHeight < pos.top ||
        t > pos.top + pos.height;
      return !noOverlap;
    });
  };

  // Try different positions if overlapping
  if (checkOverlap(top, left)) {
    // Try stacking below existing popups
    for (const pos of existingPositions) {
      const newTop = pos.top + pos.height + POPUP_GAP;
      if (newTop + clampedHeight < maxHeight && !checkOverlap(newTop, left)) {
        top = newTop;
        break;
      }
    }

    // If still overlapping, try stacking to the right
    if (checkOverlap(top, left)) {
      for (const pos of existingPositions) {
        const newLeft = pos.left + pos.width + POPUP_GAP;
        if (
          newLeft + popupWidth < viewportWidth - POPUP_PADDING &&
          !checkOverlap(top, newLeft)
        ) {
          left = newLeft;
          break;
        }
      }
    }

    // If still overlapping, try stacking to the left
    if (checkOverlap(top, left)) {
      for (const pos of existingPositions) {
        const newLeft = pos.left - popupWidth - POPUP_GAP;
        if (newLeft > POPUP_PADDING && !checkOverlap(top, newLeft)) {
          left = newLeft;
          break;
        }
      }
    }
  }

  return { top, left };
}

export default function DetailPopup({
  entry,
  onClose,
  anchorRect,
  stackIndex = 0,
  existingPositions = [],
  onPositionCalculated,
}: DetailPopupProps) {
  const [position, setPosition] = useState<PopupRenderPosition | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const measuredHeightRef = useRef<number | null>(null);
  const positionRef = useRef<PopupRenderPosition | null>(null);
  const mobileSideRef = useRef<MobileVerticalSide | null>(null);

  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : POPUP_WIDTH;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;
  const isMobile = viewportWidth <= MOBILE_BREAKPOINT;
  const popupWidth = Math.min(POPUP_WIDTH, Math.max(240, viewportWidth - POPUP_PADDING * 2));
  const popupMaxHeight = isMobile
    ? Math.min(Math.round(viewportHeight * 0.4), viewportHeight - POPUP_PADDING * 2)
    : viewportHeight - POPUP_PADDING * 2;

  useEffect(() => {
    measuredHeightRef.current = null;
    mobileSideRef.current = null;
  }, [entry.id, entry.type, anchorRect]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    if (anchorRect) {
      const estimatedHeight = Math.min(POPUP_HEIGHT_ESTIMATE, popupMaxHeight);
      if (isMobile) {
        mobileSideRef.current = chooseMobileVerticalSide(
          anchorRect,
          estimatedHeight,
          mobileSideRef.current
        );
      }
      const pos = calculatePopupPosition(
        anchorRect,
        existingPositions,
        popupWidth,
        estimatedHeight,
        isMobile,
        mobileSideRef.current
      );
      setPosition(pos);
      onPositionCalculated?.({
        top: pos.top,
        left: pos.left,
        width: popupWidth,
        height: estimatedHeight,
      });
    }
  }, [anchorRect, existingPositions, isMobile, onPositionCalculated, popupMaxHeight, popupWidth]);

  useEffect(() => {
    if (!position || !popupRef.current || !anchorRect) return;

    const measure = () => {
      if (!popupRef.current) return;
      const rect = popupRef.current.getBoundingClientRect();
      const nextHeight = Math.min(rect.height, popupMaxHeight);
      if (isMobile) {
        mobileSideRef.current = chooseMobileVerticalSide(
          anchorRect,
          nextHeight,
          mobileSideRef.current
        );
      }
      const nextPosition = calculatePopupPosition(
        anchorRect,
        existingPositions,
        popupWidth,
        nextHeight,
        isMobile,
        mobileSideRef.current
      );
      const currentPosition = positionRef.current;
      if (
        !currentPosition ||
        nextPosition.top !== currentPosition.top ||
        nextPosition.left !== currentPosition.left ||
        nextPosition.bottom !== currentPosition.bottom
      ) {
        setPosition(nextPosition);
      }
      if (
        measuredHeightRef.current === null ||
        Math.abs(measuredHeightRef.current - nextHeight) > 1
      ) {
        measuredHeightRef.current = nextHeight;
        onPositionCalculated?.({
          top: nextPosition.top,
          left: nextPosition.left,
          width: popupWidth,
          height: nextHeight,
        });
      }
    };

    measure();
    const observer = new ResizeObserver(() => measure());
    observer.observe(popupRef.current);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [
    anchorRect,
    existingPositions,
    isMobile,
    onPositionCalculated,
    popupMaxHeight,
    popupWidth,
  ]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (popupRef.current && popupRef.current.contains(target)) {
        return;
      }
      onClose();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onClose]);

  const popupStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 50 + stackIndex,
    maxHeight: popupMaxHeight,
    width: popupWidth,
  };

  if (position) {
    popupStyle.left = position.left;
    if (position.bottom !== undefined) {
      popupStyle.bottom = position.bottom;
    } else {
      popupStyle.top = position.top;
    }
  }

  if (!position) return null;

  return createPortal(
    <div ref={popupRef} style={popupStyle} className="max-w-full">
      <CardBackground className="max-h-full overflow-y-auto bg-black p-5 text-foreground shadow-xl">
        <button
          className="icon-button absolute right-3 top-3 flex h-6 w-6 cursor-pointer items-center justify-center border-none bg-transparent p-0 transition-[filter] hover:brightness-125"
          onClick={onClose}
        >
          <img src={exitIcon} alt="Close" className="h-5 w-5" />
        </button>
        <DetailCardContent entry={entry} />
      </CardBackground>
    </div>,
    document.body
  );
}
