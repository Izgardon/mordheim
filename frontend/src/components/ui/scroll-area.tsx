import * as React from "react"

import { ChevronDown, ChevronUp } from "lucide-react"

// utils
import { cn } from "@/lib/utils"

type ScrollAreaProps = {
  className?: string
  viewportClassName?: string
  trackClassName?: string
  thumbClassName?: string
  scrollStep?: number
  children: React.ReactNode
}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  (
    {
      className,
      viewportClassName,
      trackClassName,
      thumbClassName,
      scrollStep = 40,
      children,
    },
    ref
  ) => {
    const showScrollbar = className?.includes("table-scroll") ?? false
    const viewportRef = React.useRef<HTMLDivElement | null>(null)
    const trackRef = React.useRef<HTMLDivElement | null>(null)
    const thumbRef = React.useRef<HTMLDivElement | null>(null)
    const [isScrollable, setIsScrollable] = React.useState(false)

    React.useImperativeHandle(ref, () => viewportRef.current as HTMLDivElement)

    const updateThumb = React.useCallback(() => {
      if (!showScrollbar) {
        return
      }
      const viewport = viewportRef.current
      const track = trackRef.current
      const thumb = thumbRef.current
      if (!viewport || !track || !thumb) {
        return
      }

      const { scrollHeight, clientHeight, scrollTop } = viewport
      const maxScrollTop = Math.max(0, scrollHeight - clientHeight)
      const trackHeight = track.clientHeight
      const thumbHeight = Math.max(24, (clientHeight / scrollHeight) * trackHeight)
      const maxThumbTop = Math.max(0, trackHeight - thumbHeight)
      const thumbTop = maxScrollTop > 0 ? (scrollTop / maxScrollTop) * maxThumbTop : 0

      thumb.style.height = `${thumbHeight}px`
      thumb.style.transform = `translate(-50%, ${thumbTop}px)`
      setIsScrollable(maxScrollTop > 1)
    }, [])

    React.useEffect(() => {
      if (!showScrollbar) {
        return
      }
      const viewport = viewportRef.current
      if (!viewport) {
        return
      }

      updateThumb()

      const handleScroll = () => updateThumb()
      viewport.addEventListener("scroll", handleScroll, { passive: true })

      let resizeObserver: ResizeObserver | null = null
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => updateThumb())
        resizeObserver.observe(viewport)
      } else {
        window.addEventListener("resize", updateThumb)
      }

      return () => {
        viewport.removeEventListener("scroll", handleScroll)
        if (resizeObserver) {
          resizeObserver.disconnect()
        } else {
          window.removeEventListener("resize", updateThumb)
        }
      }
    }, [showScrollbar, updateThumb])

    React.useEffect(() => {
      if (!showScrollbar) {
        return
      }
      updateThumb()
    }, [children, showScrollbar, updateThumb])

    const handleStep = (direction: "up" | "down") => {
      const viewport = viewportRef.current
      if (!viewport) {
        return
      }
      const delta = direction === "up" ? -scrollStep : scrollStep
      viewport.scrollBy({ top: delta, behavior: "smooth" })
    }

    const handleTrackPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
      const viewport = viewportRef.current
      const track = trackRef.current
      if (!viewport || !track) {
        return
      }
      const rect = track.getBoundingClientRect()
      const clickY = event.clientY - rect.top
      const { scrollHeight, clientHeight } = viewport
      const maxScrollTop = Math.max(0, scrollHeight - clientHeight)
      const trackHeight = rect.height
      const thumbHeight = Math.max(24, (clientHeight / scrollHeight) * trackHeight)
      const maxThumbTop = Math.max(0, trackHeight - thumbHeight)
      const nextThumbTop = Math.min(Math.max(0, clickY - thumbHeight / 2), maxThumbTop)
      const nextScrollTop = maxThumbTop > 0 ? (nextThumbTop / maxThumbTop) * maxScrollTop : 0
      viewport.scrollTo({ top: nextScrollTop, behavior: "smooth" })
    }

    const handleThumbPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
      const viewport = viewportRef.current
      const track = trackRef.current
      if (!viewport || !track) {
        return
      }

      event.preventDefault()
      const startY = event.clientY
      const startScrollTop = viewport.scrollTop
      const { scrollHeight, clientHeight } = viewport
      const maxScrollTop = Math.max(0, scrollHeight - clientHeight)
      const trackHeight = track.clientHeight
      const thumbHeight = Math.max(24, (clientHeight / scrollHeight) * trackHeight)
      const maxThumbTop = Math.max(0, trackHeight - thumbHeight)

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientY - startY
        const scrollDelta = maxThumbTop > 0 ? (delta / maxThumbTop) * maxScrollTop : 0
        viewport.scrollTop = Math.min(Math.max(0, startScrollTop + scrollDelta), maxScrollTop)
      }

      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove)
        window.removeEventListener("pointerup", handlePointerUp)
      }

      window.addEventListener("pointermove", handlePointerMove)
      window.addEventListener("pointerup", handlePointerUp)
    }

    if (!showScrollbar) {
      return (
        <div className={cn("relative min-h-0", className)}>
          <div
            ref={viewportRef}
            className={cn("min-h-0 overflow-auto", viewportClassName)}
          >
            {children}
          </div>
        </div>
      )
    }

    return (
      <div
        className={cn("relative flex min-h-0 items-stretch", className)}
        data-scrollable={isScrollable ? "true" : "false"}
      >
        <div
          ref={viewportRef}
          className={cn(
            "flex-1 min-h-0 overflow-auto",
            showScrollbar && "scrollbar-hidden",
            viewportClassName
          )}
        >
          {children}
        </div>
        <div className={cn("flex h-full w-6 flex-col items-center gap-1", trackClassName)}>
          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center"
            aria-label="Scroll up"
            onClick={() => handleStep("up")}
          >
            <ChevronUp className="h-3 w-3" aria-hidden="true" />
          </button>
          <div
            ref={trackRef}
            className="relative flex-1 w-full"
            onPointerDown={handleTrackPointerDown}
          >
            <div
              ref={thumbRef}
              className={cn(
                "absolute left-1/2 top-0 w-2 -translate-x-1/2 rounded-full bg-muted/70",
                thumbClassName
              )}
              onPointerDown={handleThumbPointerDown}
            />
          </div>
          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center"
            aria-label="Scroll down"
            onClick={() => handleStep("down")}
          >
            <ChevronDown className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      </div>
    )
  }
)

ScrollArea.displayName = "ScrollArea"

export { ScrollArea }
