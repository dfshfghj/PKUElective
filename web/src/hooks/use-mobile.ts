import * as React from "react"

import { isMobilePlatform } from "@/safe-area"

const MOBILE_BREAKPOINT = 768

function useMobileQuery(includeMobilePlatform: boolean) {
  const getMatches = React.useCallback(
    () =>
      (includeMobilePlatform && isMobilePlatform()) ||
      window.innerWidth < MOBILE_BREAKPOINT,
    [includeMobilePlatform],
  )
  const [matches, setMatches] = React.useState(getMatches)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setMatches(getMatches())
    }
    mql.addEventListener("change", onChange)
    setMatches(getMatches())
    return () => mql.removeEventListener("change", onChange)
  }, [getMatches])

  return matches
}

export function useIsMobile() {
  return useMobileQuery(true)
}

export function useIsCompactViewport() {
  return useMobileQuery(false)
}
