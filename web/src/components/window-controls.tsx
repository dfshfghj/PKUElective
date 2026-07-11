import { useEffect, useState, type ReactNode } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { Button } from "@/components/ui/button";

export function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);
  const desktop = isTauri();
  const isMacOS = navigator.userAgent.includes("Macintosh");

  useEffect(() => {
    if (!desktop) {
      return;
    }

    const appWindow = getCurrentWindow();
    let disposed = false;

    void appWindow.isMaximized().then((maximized) => {
      if (!disposed) setIsMaximized(maximized);
    });

    void appWindow.onResized(() => {
      void appWindow.isMaximized().then((maximized) => {
        if (!disposed) setIsMaximized(maximized);
      });
    }).then((unlisten) => {
      if (disposed) unlisten();
    });

    return () => {
      disposed = true;
    };
  }, [desktop]);

  if (!desktop || isMacOS) {
    return null;
  }

  const appWindow = getCurrentWindow();

  return (
    <div className="-my-4 -mr-4 flex h-full" aria-label="窗口控制">
      <WindowControl aria-label="最小化" onClick={() => void appWindow.minimize()}>
        <i aria-hidden="true" className="codicon codicon-chrome-minimize text-base" />
      </WindowControl>
      <WindowControl
        aria-label={isMaximized ? "还原窗口" : "最大化窗口"}
        onClick={() => void appWindow.toggleMaximize()}
      >
        <i
          aria-hidden="true"
          className={`codicon ${isMaximized ? "codicon-chrome-restore" : "codicon-chrome-maximize"} text-base`}
        />
      </WindowControl>
      <WindowControl aria-label="关闭" destructive onClick={() => void appWindow.close()}>
        <i aria-hidden="true" className="codicon codicon-chrome-close text-base" />
      </WindowControl>
    </div>
  );
}

function WindowControl(props: {
  "aria-label": string;
  children: ReactNode;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      aria-label={props["aria-label"]}
      className={
        props.destructive
          ? "h-full w-12 rounded-none text-stone-600 hover:bg-rose-500 hover:text-white dark:text-stone-300 dark:hover:bg-rose-600 dark:hover:text-white"
          : "h-full w-12 rounded-none text-stone-600 hover:bg-stone-200/80 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-50"
      }
      onClick={props.onClick}
      type="button"
      variant="ghost"
    >
      {props.children}
    </Button>
  );
}
