import { type ReactNode } from "react";

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

export function PageHeader(props: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="mb-2 text-xs uppercase tracking-[0.24em] text-stone-400 dark:text-stone-500">
          {props.eyebrow}
        </p>
        <h2 className="text-3xl font-semibold leading-tight text-stone-950 dark:text-stone-100 md:text-4xl">
          {props.title}
        </h2>
        {props.description ? (
          <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-500 dark:text-stone-400">
            {props.description}
          </p>
        ) : null}
      </div>
      {props.actions ? <div className="flex flex-wrap gap-3">{props.actions}</div> : null}
    </header>
  );
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

export function formatTimestamp(unixMs: number) {
  return new Date(unixMs).toLocaleString("zh-CN", {
    hour12: false,
  });
}
