import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "./components/ui/combobox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { cn } from "./lib/utils";
import { WindowControls } from "./components/window-controls";

export function PageHeader(props: {
  breadcrumb: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h2 className="text-2xl font-semibold leading-tight text-stone-950 dark:text-stone-100">
          {props.title}
        </h2>
        {props.description ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500 dark:text-stone-400">
            {props.description}
          </p>
        ) : null}
      </div>
      {props.actions ? <div className="flex flex-wrap gap-3">{props.actions}</div> : null}
    </header>
  );
}

export type BreadcrumbItem = { label: string; to?: string };

export function AppTitlebar({
  breadcrumbs,
  breadcrumb,
}: {
  breadcrumbs?: BreadcrumbItem[];
  breadcrumb?: string;
}) {
  const items = breadcrumbs ?? [{ label: breadcrumb ?? "HEED" }];

  return (
    <div className="flex h-12 shrink-0 items-center border-b border-sidebar-border bg-white/80 px-4 mb-4 backdrop-blur dark:border-stone-800/60 dark:bg-stone-950/80">
      <div
        className="flex flex-1 items-center gap-1 self-stretch"
        data-tauri-drag-region
        onDoubleClick={() => {
          void toggleCurrentWindowMaximize();
        }}
      >
        {items.map((item, index) => (
          <span className="flex items-center gap-1" key={`${item.label}-${index}`}>
            <ChevronRight className="pointer-events-none h-3.5 w-3.5 text-stone-400 dark:text-stone-500" />
            {item.to ? (
              <Link
                className="text-sm text-stone-500 transition-colors hover:text-stone-950 dark:text-stone-400 dark:hover:text-stone-100"
                data-tauri-drag-region="false"
                to={item.to}
              >
                {item.label}
              </Link>
            ) : (
              <span className="pointer-events-none text-sm text-stone-500 dark:text-stone-400">{item.label}</span>
            )}
          </span>
        ))}
      </div>
      <WindowControls />
    </div>
  );
}

async function toggleCurrentWindowMaximize() {
  const { isTauri } = await import("@tauri-apps/api/core");
  if (!isTauri()) return;

  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().toggleMaximize();
}

export function Surface(props: {
  title?: string;
  meta?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden", props.className)}>
      {props.title ? (
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4">
            <CardTitle>{props.title}</CardTitle>
            {props.meta ? (
              <span className="shrink-0 text-sm text-stone-500 dark:text-stone-400">
                {props.meta}
              </span>
            ) : null}
          </div>
        </CardHeader>
      ) : null}
      <CardContent className={props.title ? undefined : "p-6"}>{props.children}</CardContent>
    </Card>
  );
}

export function PrimaryButton(props: {
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  children: ReactNode;
}) {
  return <Button {...props} />;
}

export function SecondaryButton(props: {
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  children: ReactNode;
}) {
  return <Button variant="secondary" {...props} />;
}

export function InputField(props: {
  label: string;
  value?: string | number;
  defaultValue?: string | number;
  type?: string;
  name?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400">
        {props.label}
      </span>
      <Input
        defaultValue={props.defaultValue}
        name={props.name}
        onChange={props.onChange ? (event) => props.onChange?.(event.target.value) : undefined}
        placeholder={props.placeholder}
        type={props.type}
        value={props.value}
      />
    </label>
  );
}

export function SelectField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  disabled?: boolean;
}) {
  const selectedOption = props.options.find((option) => option.value === props.value) ?? null;

  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400">
        {props.label}
      </span>
      <Combobox
        disabled={props.disabled}
        itemToStringValue={(option) => option.label}
        items={props.options}
        onValueChange={(option) => props.onChange(option?.value ?? "")}
        value={selectedOption}
      >
        <ComboboxInput placeholder={`搜索${props.label}...`} />
        <ComboboxContent>
          <ComboboxEmpty>没有匹配项</ComboboxEmpty>
          <ComboboxList>
            {(option) => (
              <ComboboxItem key={option.value} value={option}>
                {option.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </label>
  );
}

export function StatusBadge(props: { online: boolean; label: string }) {
  return (
    <Badge
      className={
        props.online
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
          : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
      }
    >
      {props.label}
    </Badge>
  );
}

export function EmptyState(props: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 px-5 py-7 text-sm text-stone-500 dark:border-stone-800 dark:bg-stone-900/80 dark:text-stone-400">
      {props.text}
    </div>
  );
}

export function LineBreakText({ text }: { text: string | null | undefined }) {
  if (!text || text.trim() === "") {
    return <span className="text-stone-400 dark:text-stone-500">—</span>;
  }

  return (
    <span>
      {text.split(/\r?\n/).map((line, index) => (
        <span key={index}>
          {index > 0 ? <br /> : null}
          {line}
        </span>
      ))}
    </span>
  );
}

export function formatTimestamp(unixMs: number) {
  return new Date(unixMs).toLocaleString("zh-CN", {
    hour12: false,
  });
}
