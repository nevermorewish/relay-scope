"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> & {
    showScrollButtons?: boolean
    showScrollbar?: boolean
    viewportClassName?: string
  }
>(({ className, children, position = "popper", showScrollButtons = true, showScrollbar = false, viewportClassName, ...props }, ref) => {
  const [viewport, setViewport] = React.useState<React.ElementRef<typeof SelectPrimitive.Viewport> | null>(null)
  const [scrollbar, setScrollbar] = React.useState({ visible: false, size: 100, position: 0 })
  const scrollbarTrackRef = React.useRef<HTMLDivElement>(null)
  const dragOffsetRef = React.useRef<number | null>(null)
  const viewportId = React.useId()

  const updateScrollbar = React.useCallback(() => {
    if (!viewport) return
    const scrollableDistance = viewport.scrollHeight - viewport.clientHeight
    const visible = scrollableDistance > 1
    const size = visible ? Math.max(18, (viewport.clientHeight / viewport.scrollHeight) * 100) : 100
    const position = visible ? (viewport.scrollTop / scrollableDistance) * (100 - size) : 0
    setScrollbar({ visible, size, position })
  }, [viewport])

  React.useEffect(() => {
    if (!viewport) return
    updateScrollbar()
    const observer = new ResizeObserver(updateScrollbar)
    observer.observe(viewport)
    if (viewport.firstElementChild) observer.observe(viewport.firstElementChild)
    return () => observer.disconnect()
  }, [updateScrollbar, viewport])

  const scrollToPointer = React.useCallback((clientY: number) => {
    const track = scrollbarTrackRef.current
    if (!track || !viewport) return
    const bounds = track.getBoundingClientRect()
    const thumbHeight = bounds.height * (scrollbar.size / 100)
    const availableTrack = bounds.height - thumbHeight
    if (availableTrack <= 0) return
    const dragOffset = dragOffsetRef.current ?? thumbHeight / 2
    const thumbTop = Math.min(availableTrack, Math.max(0, clientY - bounds.top - dragOffset))
    viewport.scrollTop = (thumbTop / availableTrack) * (viewport.scrollHeight - viewport.clientHeight)
    updateScrollbar()
  }, [scrollbar.size, updateScrollbar, viewport])

  const handleScrollbarPointerDown = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const track = scrollbarTrackRef.current
    if (!track) return
    event.preventDefault()
    event.stopPropagation()
    const bounds = track.getBoundingClientRect()
    const thumbHeight = bounds.height * (scrollbar.size / 100)
    const thumbTop = bounds.height * (scrollbar.position / 100)
    const pointerPosition = event.clientY - bounds.top
    dragOffsetRef.current = pointerPosition >= thumbTop && pointerPosition <= thumbTop + thumbHeight
      ? pointerPosition - thumbTop
      : thumbHeight / 2
    track.setPointerCapture(event.pointerId)
    scrollToPointer(event.clientY)
  }, [scrollToPointer, scrollbar.position, scrollbar.size])

  const handleScrollbarPointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragOffsetRef.current == null || !event.currentTarget.hasPointerCapture(event.pointerId)) return
    event.preventDefault()
    scrollToPointer(event.clientY)
  }, [scrollToPointer])

  const stopScrollbarDrag = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    dragOffsetRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  const handleScrollbarKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!viewport) return
    const step = 48
    const page = viewport.clientHeight * 0.8
    if (event.key === "ArrowUp") viewport.scrollTop -= step
    else if (event.key === "ArrowDown") viewport.scrollTop += step
    else if (event.key === "PageUp") viewport.scrollTop -= page
    else if (event.key === "PageDown") viewport.scrollTop += page
    else if (event.key === "Home") viewport.scrollTop = 0
    else if (event.key === "End") viewport.scrollTop = viewport.scrollHeight
    else return
    event.preventDefault()
    event.stopPropagation()
    updateScrollbar()
  }, [updateScrollbar, viewport])

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        className={cn(
          "relative z-50 max-h-[--radix-select-content-available-height] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-select-content-transform-origin]",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className
        )}
        position={position}
        {...props}
      >
        {showScrollButtons ? <SelectScrollUpButton /> : null}
        <SelectPrimitive.Viewport
          id={viewportId}
          ref={setViewport}
          onScroll={updateScrollbar}
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
            showScrollbar && "pr-4",
            viewportClassName
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        {showScrollbar && scrollbar.visible ? (
          <div
            ref={scrollbarTrackRef}
            role="scrollbar"
            aria-label="厂商列表滚动条"
            aria-controls={viewportId}
            aria-orientation="vertical"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((scrollbar.position / Math.max(1, 100 - scrollbar.size)) * 100)}
            tabIndex={0}
            className="absolute bottom-2 right-1 top-2 z-10 w-2.5 touch-none cursor-default rounded-full bg-muted shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onPointerDown={handleScrollbarPointerDown}
            onPointerMove={handleScrollbarPointerMove}
            onPointerUp={stopScrollbarDrag}
            onPointerCancel={stopScrollbarDrag}
            onKeyDown={handleScrollbarKeyDown}
          >
            <div
              className="absolute left-0.5 w-1.5 cursor-default rounded-full bg-muted-foreground/75"
              style={{ height: `${scrollbar.size}%`, top: `${scrollbar.position}%` }}
            />
          </div>
        ) : null}
        {showScrollButtons ? <SelectScrollDownButton /> : null}
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
})
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", className)}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
