import * as React from "react"

import scrollBar from "@/assets/components/scroll_bar.png"
import scrollBox from "@/assets/components/scroll_box.png"
import topArrow from "@/assets/components/top_arrow.png"
import topArrowHover from "@/assets/components/top_arrow_hover.png"
import botArrow from "@/assets/components/bot_arrow.png"
import botArrowHover from "@/assets/components/bot_arrow_hover.png"

// utils
import { cn } from "@/lib/utils"

type ImageScrollAreaProps = {
  className?: string
  viewportClassName?: string
  trackClassName?: string
  thumbClassName?: string
  scrollStep?: number
  children: React.ReactNode
}

const ImageScrollArea = React.forwardRef<HTMLDivElement, ImageScrollAreaProps>(
  (
    {
      className,
      viewportClassName,
      trackClassName,
      thumbClassName,
      scrollStep = 48,
      children,
    },
    ref
  ) => {
    const viewportRef = React.useRef<HTMLDivElement | null>(null)
    const trackRef = React.useRef<HTMLDivElement | null>(null)
    const thumbRef = React.useRef<HTMLDivElement | null>(null)
    const [isScrollable, setIsScrollable] = React.useState(false)
    const [isAtTop, setIsAtTop] = React.useState(true)
    const [isAtBottom, setIsAtBottom] = React.useState(false)
    const holdIntervalRef = React.useRef<number | null>(null)

    React.useImperativeHandle(ref, () => viewportRef.current as HTMLDivElement)

    const updateThumb = React.useCallback(() => {
      const viewport = viewportRef.current
      const track = trackRef.current
      const thumb = thumbRef.current
      if (!viewport || !track || !thumb) {
        return
      }

      const { scrollHeight, clientHeight, scrollTop } = viewport
      const maxScrollTop = Math.max(0, scrollHeight - clientHeight)
      const trackHeight = track.clientHeight
      const minThumbHeight = 28
      const thumbHeight = Math.max(minThumbHeight, (clientHeight / scrollHeight) * trackHeight)
      const maxThumbTop = Math.max(0, trackHeight - thumbHeight)
      const thumbTop = maxScrollTop > 0 ? (scrollTop / maxScrollTop) * maxThumbTop : 0

      thumb.style.height = `${thumbHeight}px`
      thumb.style.transform = `translate(-50%, ${thumbTop}px)`
      setIsScrollable(maxScrollTop > 1)
      setIsAtTop(scrollTop <= 1)
      setIsAtBottom(scrollTop >= maxScrollTop - 1)
    }, [])

    React.useEffect(() => {
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
    }, [updateThumb])

    React.useEffect(() => {
      updateThumb()
    }, [children, updateThumb])

    const handleStep = (direction: "up" | "down") => {
      const viewport = viewportRef.current
      if (!viewport) {
        return
      }
      const delta = direction === "up" ? -scrollStep : scrollStep
      viewport.scrollBy({ top: delta, behavior: "smooth" })
    }

    const stopHoldScroll = React.useCallback(() => {
      if (holdIntervalRef.current !== null) {
        window.clearInterval(holdIntervalRef.current)
        holdIntervalRef.current = null
      }
      window.removeEventListener("pointerup", stopHoldScroll)
      window.removeEventListener("pointercancel", stopHoldScroll)
    }, [])

    const startHoldScroll = React.useCallback(
      (direction: "up" | "down") => {
        if (holdIntervalRef.current !== null) {
          return
        }
        handleStep(direction)
        holdIntervalRef.current = window.setInterval(() => {
          handleStep(direction)
        }, 70)
        window.addEventListener("pointerup", stopHoldScroll)
        window.addEventListener("pointercancel", stopHoldScroll)
      },
      [handleStep, stopHoldScroll]
    )

    React.useEffect(() => () => stopHoldScroll(), [stopHoldScroll])

    const handleTrackPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return
      }
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
      const minThumbHeight = 28
      const thumbHeight = Math.max(minThumbHeight, (clientHeight / scrollHeight) * trackHeight)
      const maxThumbTop = Math.max(0, trackHeight - thumbHeight)
      const nextThumbTop = Math.min(Math.max(0, clickY - thumbHeight / 2), maxThumbTop)
      const nextScrollTop = maxThumbTop > 0 ? (nextThumbTop / maxThumbTop) * maxScrollTop : 0

      viewport.scrollTo({ top: nextScrollTop, behavior: "smooth" })
    }

    const handleThumbPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return
      }
      const viewport = viewportRef.current
      const track = trackRef.current
      if (!viewport || !track) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      const startY = event.clientY
      const startScrollTop = viewport.scrollTop
      const { scrollHeight, clientHeight } = viewport
      const maxScrollTop = Math.max(0, scrollHeight - clientHeight)
      const trackHeight = track.clientHeight
      const minThumbHeight = 28
      const thumbHeight = Math.max(minThumbHeight, (clientHeight / scrollHeight) * trackHeight)
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

    return (
      <div className={cn("relative flex min-h-0 flex-col overflow-hidden", className)}>
        <div
          ref={viewportRef}
          className={cn(
            "flex-1 min-h-0 overflow-auto scrollbar-hidden pr-8",
            viewportClassName
          )}
        >
          {children}
        </div>
        <div
          className="pointer-events-none absolute right-1 top-0 bottom-0 flex w-7 flex-col items-center"
          style={{ opacity: isScrollable ? 1 : 0 }}
        >
          <button
            type="button"
            aria-label="Scroll up"
            onClick={(event) => {
              if (event.detail === 0) {
                handleStep("up")
              }
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) {
                return
              }
              if (!isScrollable || isAtTop) {
                return
              }
              startHoldScroll("up")
            }}
            onPointerLeave={stopHoldScroll}
            onPointerUp={stopHoldScroll}
            onPointerCancel={stopHoldScroll}
            disabled={!isScrollable || isAtTop}
            className="icon-button group pointer-events-auto relative flex h-7 w-7 items-center justify-center disabled:cursor-not-allowed disabled:opacity-60"
          >
            <img
              src={topArrow}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-contain transition-opacity group-hover:opacity-0"
            />
            <img
              src={topArrowHover}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-contain opacity-0 transition-opacity group-hover:opacity-100"
            />
          </button>
          <div
            className={cn("pointer-events-auto relative w-full flex-1", trackClassName)}
            style={{
              backgroundImage: `url(${scrollBar})`,
              backgroundSize: "100% 100%",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
            }}
          >
            <div
              ref={trackRef}
              className="absolute inset-x-0 top-2 bottom-2"
              onPointerDown={handleTrackPointerDown}
            >
              <div
                ref={thumbRef}
                className={cn("absolute left-1/2 top-0 w-6 -translate-x-1/2", thumbClassName)}
                style={{
                  backgroundImage: `url(${scrollBox})`,
                  backgroundSize: "100% 100%",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "center",
                }}
                onPointerDown={handleThumbPointerDown}
              />
            </div>
          </div>
          <button
            type="button"
            aria-label="Scroll down"
            onClick={(event) => {
              if (event.detail === 0) {
                handleStep("down")
              }
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) {
                return
              }
              if (!isScrollable || isAtBottom) {
                return
              }
              startHoldScroll("down")
            }}
            onPointerLeave={stopHoldScroll}
            onPointerUp={stopHoldScroll}
            onPointerCancel={stopHoldScroll}
            disabled={!isScrollable || isAtBottom}
            className="icon-button group pointer-events-auto relative flex h-7 w-7 items-center justify-center disabled:cursor-not-allowed disabled:opacity-60"
          >
            <img
              src={botArrow}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-contain transition-opacity group-hover:opacity-0"
            />
            <img
              src={botArrowHover}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-contain opacity-0 transition-opacity group-hover:opacity-100"
            />
          </button>
        </div>
      </div>
    )
  }
)

ImageScrollArea.displayName = "ImageScrollArea"

export { ImageScrollArea }
