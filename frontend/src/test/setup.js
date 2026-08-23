import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import React from 'react'

// framer-motion v11 does not mount AnimatePresence-wrapped portal children in
// jsdom (no real layout/animation frames), which blocks testing any component
// that renders modals through portals. Animation behavior is not under test,
// so replace motion.* with plain DOM passthrough elements and AnimatePresence
// with a transparent wrapper.
vi.mock('framer-motion', () => {
  const stripAnimationProps = ({
    initial: _i,
    animate: _a,
    exit: _e,
    transition: _t,
    variants: _v,
    whileHover: _h,
    whileTap: _p,
    whileInView: _w,
    whileFocus: _f,
    whileDrag: _d,
    layout: _l,
    layoutId: _lid,
    ...rest
  }) => rest

  const createMotionProxy = () =>
    new Proxy({}, {
      get: (_, tag) => {
        if (typeof tag !== 'string') return undefined
        const MotionComponent = React.forwardRef((props, ref) =>
          React.createElement(tag, { ...stripAnimationProps(props), ref })
        )
        MotionComponent.displayName = `motion.${String(tag)}`
        return MotionComponent
      },
    })

  const motionProxy = new Proxy({}, {
    get: (_, tag) => {
      if (typeof tag !== 'string') return undefined
      const MotionComponent = React.forwardRef((props, ref) =>
        React.createElement(tag, { ...stripAnimationProps(props), ref })
      )
      MotionComponent.displayName = `motion.${String(tag)}`
      return MotionComponent
    },
  })

  return {
    motion: motionProxy,
    AnimatePresence: ({ children }) => children,
    LayoutGroup: ({ children }) => children,
    MotionConfig: ({ children }) => children,
    useAnimation: () => ({ start: vi.fn(), stop: vi.fn(), set: vi.fn() }),
    useInView: () => true,
    useScroll: () => ({ scrollY: { get: () => 0, on: () => () => {} }, scrollYProgress: { get: () => 0, on: () => () => {} } }),
    useTransform: () => ({ get: () => 0, on: () => () => {} }),
    useSpring: (v) => v,
    useMotionValue: (v) => ({ get: () => v, on: () => () => {}, set: () => {} }),
  }
})

// Unmount React trees between tests
afterEach(() => {
  cleanup()
})

// Minimal browser-API stubs used by framer-motion and streaming hooks.
// Individual tests may override these with their own doubles.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

if (!window.IntersectionObserver) {
  window.IntersectionObserver = class {
    constructor(callback) {
      this.callback = callback
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
