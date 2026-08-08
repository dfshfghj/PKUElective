import type { ComponentProps, ReactNode } from "react";
import { useId, useRef, useState } from "react";
import type { ColumnDef, SortingState, VisibilityState } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ChevronsUpDown, Columns3 } from "lucide-react";

import { useIsCompactViewport } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type DataTableProps<TData> = {
  columns: ColumnDef<TData>[];
  data: TData[];
  getRowId?: (row: TData, index: number) => string;
  initialVisibility?: VisibilityState;
  emptyText?: string;
  mobileCardTitle?: (row: TData) => ReactNode;
  mobileCardDescription?: (row: TData) => ReactNode;
  mobileCardBadges?: (row: TData) => ReactNode;
};

export function DataTable<TData>({
  columns,
  data,
  getRowId,
  initialVisibility,
  emptyText = "暂无数据。",
  mobileCardTitle,
  mobileCardDescription,
  mobileCardBadges,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    initialVisibility ?? {},
  );
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [expandedMobileRows, setExpandedMobileRows] = useState<Set<string>>(() => new Set());
  const isMobile = useIsCompactViewport();

  function toggleMobileRow(rowId: string) {
    setExpandedMobileRows((current) => {
      const next = new Set(current);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }

  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    getRowId,
    getSortedRowModel: getSortedRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: setSorting,
    state: {
      sorting,
      columnVisibility,
    },
  });

  const hideableColumns = table
    .getAllColumns()
    .filter((column) => column.getCanHide())
    .map((column) => ({
      id: column.id,
      label: getColumnLabel(column.columnDef, column.id),
      visible: column.getIsVisible(),
      toggle: (checked: boolean) => column.toggleVisibility(checked),
    }));

  return (
    <div className="min-w-0 space-y-2 sm:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="text-xs text-stone-500 sm:text-sm dark:text-stone-400">
          {table.getRowModel().rows.length} 条结果
        </div>
        {hideableColumns.length > 0 ? (
          <div className="relative hidden sm:block">
            <Button
              aria-expanded={showColumnMenu}
              aria-haspopup="menu"
              className="gap-2"
              onClick={() => setShowColumnMenu((current) => !current)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Columns3 className="size-4" />
              显示字段
              <ChevronDown className="size-4" />
            </Button>
            {showColumnMenu ? (
              <div
                aria-label="列显示设置"
                className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-stone-200/80 bg-white p-2 shadow-lg dark:border-stone-800 dark:bg-stone-950"
                role="menu"
              >
                <div className="mt-1 grid gap-1">
                  {hideableColumns.map((column) => (
                    <ColumnVisibilityToggle
                      key={column.id}
                      id={column.id}
                      label={column.label}
                      onToggle={column.toggle}
                      visible={column.visible}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {isMobile ? (
        table.getRowModel().rows.length > 0 ? (
          <div className="grid min-w-0 gap-1">
            {table.getRowModel().rows.map((row) => {
              const visibleCells = row.getVisibleCells();
              const contentCells = visibleCells.filter((cell) => {
                const meta = getColumnMeta(cell.column.columnDef);
                return !meta?.mobileHidden && !meta?.mobileSlot;
              });
              const summaryCells = visibleCells.filter((cell) => {
                const meta = getColumnMeta(cell.column.columnDef);
                return !meta?.mobileHidden && meta?.mobileSlot === "summary";
              });
              const footerCells = visibleCells.filter((cell) => {
                const meta = getColumnMeta(cell.column.columnDef);
                return !meta?.mobileHidden && meta?.mobileSlot === "footer";
              });
              const isExpanded = expandedMobileRows.has(row.id);

              if (mobileCardTitle) {
                return (
                  <Card
                    key={row.id}
                    aria-expanded={isExpanded}
                    className="min-w-0 cursor-pointer gap-0 overflow-hidden rounded-xl bg-white/90 py-2 shadow-none dark:border-stone-800 dark:bg-stone-950/80"
                    onClick={(event) => {
                      const target = event.target;
                      if (
                        target instanceof Element &&
                        target.closest("button, a, input, select, textarea, [role=button]")
                      ) {
                        return;
                      }
                      toggleMobileRow(row.id);
                    }}
                  >
                    <CardHeader className="min-w-0 gap-0 px-2.5 py-0">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <CardTitle className="min-w-16 flex-1 truncate text-sm font-semibold text-stone-950 dark:text-stone-100">
                          {mobileCardTitle(row.original)}
                        </CardTitle>
                        {!isExpanded && mobileCardDescription ? (
                          <CardDescription className="hidden min-w-0 max-w-40 truncate text-[11px] text-stone-500 min-[520px]:block dark:text-stone-400">
                            {mobileCardDescription(row.original)}
                          </CardDescription>
                        ) : null}
                        {!isExpanded && mobileCardBadges ? (
                          <div className="hidden max-w-44 items-center gap-1 overflow-hidden whitespace-nowrap min-[700px]:flex [&>*]:shrink-0 [&>*]:px-1.5 [&>*]:py-0.5 [&>*]:text-[10px]">
                            {mobileCardBadges(row.original)}
                          </div>
                        ) : null}
                        {summaryCells.map((cell) => (
                          <div
                            key={cell.id}
                            className="flex shrink-0 items-center gap-1 text-xs text-stone-500 dark:text-stone-400 [&_input]:h-8 [&_input]:w-14 [&_input]:px-1"
                          >
                            <span className="hidden min-[360px]:inline">
                              {getColumnLabel(cell.column.columnDef, cell.column.id)}
                            </span>
                            <div className="text-stone-800 dark:text-stone-200">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </div>
                          </div>
                        ))}
                        {footerCells.map((cell) => (
                          <div
                            key={cell.id}
                            className="shrink-0 [&_button]:h-8 [&_button]:px-2.5 [&_button]:text-xs"
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </div>
                        ))}
                        {/*
                          <Button
                            aria-label={isExpanded ? "收起课程详情" : "展开课程详情"}
                            className="size-8 shrink-0 p-0"
                            onClick={() => toggleMobileRow(row.id)}
                            size="icon"
                            type="button"
                            variant="ghost"
                          >
                            {isExpanded ? (
                              <ChevronUp className="size-4" />
                            ) : (
                              <ChevronDown className="size-4" />
                            )}
                          </Button>
                        */}
                      </div>
                    </CardHeader>
                    {isExpanded ? (
                      <>
                        {mobileCardDescription || mobileCardBadges ? (
                          <div className="space-y-1.5 px-3 pb-1 pt-2">
                            {mobileCardDescription ? (
                              <CardDescription className="break-words text-xs leading-5 text-stone-500 dark:text-stone-400">
                                {mobileCardDescription(row.original)}
                              </CardDescription>
                            ) : null}
                            {mobileCardBadges ? (
                              <div className="flex flex-wrap gap-1 [&>*]:px-2 [&>*]:py-0.5 [&>*]:text-[11px]">
                                {mobileCardBadges(row.original)}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        <CardContent className="grid min-w-0 gap-0 px-3 pt-1">
                          {contentCells.map((cell) => {
                            const label = getColumnLabel(cell.column.columnDef, cell.column.id);
                            return (
                              <div
                                key={cell.id}
                                className="flex min-w-0 items-start justify-between gap-3 border-t border-stone-200/60 py-2 dark:border-stone-800/70"
                              >
                                <div className="shrink-0 text-xs text-stone-500 dark:text-stone-400">
                                  {label}
                                </div>
                                <div className="min-w-0 break-words text-right text-xs leading-5 text-stone-800 dark:text-stone-200">
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </div>
                              </div>
                            );
                          })}
                        </CardContent>
                      </>
                    ) : null}
                  </Card>
                );
              }

              return (
                <Card
                  key={row.id}
                  className="min-w-0 gap-2 overflow-hidden rounded-xl border border-stone-900/8 bg-white/90 py-3 shadow-none dark:border-stone-800 dark:bg-stone-950/80"
                >
                  <CardHeader className="min-w-0 gap-2 px-3 pb-1">
                    <div className="min-w-0 space-y-0.5">
                      {mobileCardDescription ? (
                        <CardDescription className="break-words text-xs leading-5 text-stone-500 dark:text-stone-400">
                          {mobileCardDescription(row.original)}
                        </CardDescription>
                      ) : null}
                    </div>
                    {mobileCardBadges ? (
                      <div className="flex flex-wrap gap-1 [&>*]:px-2 [&>*]:py-0.5 [&>*]:text-[11px]">{mobileCardBadges(row.original)}</div>
                    ) : null}
                  </CardHeader>
                  <CardContent className="grid min-w-0 gap-0 px-3">
                    {contentCells.map((cell) => {
                      const label = getColumnLabel(cell.column.columnDef, cell.column.id);
                      return (
                        <div
                          key={cell.id}
                          className="flex min-w-0 items-start justify-between gap-3 border-t border-stone-200/60 py-2 first:border-t-0 dark:border-stone-800/70"
                        >
                          <div className="shrink-0 text-xs text-stone-500 dark:text-stone-400">
                            {label}
                          </div>
                          <div className="min-w-0 break-words text-right text-xs leading-5 text-stone-800 dark:text-stone-200">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                  {footerCells.length > 0 ? (
                    <CardFooter className="flex-col items-stretch gap-2 border-t border-stone-200/70 bg-stone-50/60 px-3 py-2 dark:border-stone-800 dark:bg-stone-900/60 [&_button]:w-full">
                      {footerCells.map((cell) => (
                        <div key={cell.id} className="w-full">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      ))}
                    </CardFooter>
                  ) : null}
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-stone-900/8 bg-white/80 px-4 py-8 text-center text-sm text-stone-500 dark:border-stone-800 dark:bg-stone-950/80 dark:text-stone-400">
            {emptyText}
          </div>
        )
      ) : (
        <ScrollArea className="rounded-3xl border border-stone-900/8 dark:border-stone-800">
          <Table className="min-w-max bg-white/80 dark:bg-stone-950/80">
            <TableHeader className="bg-stone-100/90 dark:bg-stone-900">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="py-3 font-semibold text-stone-700 dark:text-stone-300"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody className="text-stone-800 dark:text-stone-200">
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="border-stone-900/6 hover:bg-orange-50/60 dark:border-stone-800 dark:hover:bg-stone-900"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <EllipsisTableCell key={cell.id} className="py-2 align-top text-center align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </EllipsisTableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    className="px-4 py-10 text-center text-sm text-stone-500 dark:text-stone-400"
                    colSpan={table.getAllColumns().length}
                  >
                    {emptyText}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      )}
    </div>
  );
}

function EllipsisTableCell({ children, ...props }: ComponentProps<typeof TableCell>) {
  const cellRef = useRef<HTMLTableCellElement>(null);
  const [tooltipText, setTooltipText] = useState("");
  const [tooltipOpen, setTooltipOpen] = useState(false);

  function handleOpenChange(open: boolean) {
    if (!open) {
      setTooltipOpen(false);
      return;
    }

    const cell = cellRef.current;
    if (!cell) return;

    const isOverflowing =
      cell.scrollWidth > cell.clientWidth || cell.scrollHeight > cell.clientHeight;
    const fullText = cell.innerText.trim();

    if (isOverflowing && fullText) {
      setTooltipText(fullText);
      setTooltipOpen(true);
    }
  }

  return (
    <Tooltip open={tooltipOpen} onOpenChange={handleOpenChange}>
      <TooltipTrigger asChild>
        <TableCell ref={cellRef} {...props}>
          {children}
        </TableCell>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm whitespace-pre-wrap break-words">
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  );
}

type HeaderButtonProps = {
  label: string;
  sorted: false | "asc" | "desc";
  onClick: () => void;
};

export function SortableHeader({ label, sorted, onClick }: HeaderButtonProps) {
  return (
    <Button
      className="mx-auto flex h-auto w-fit px-2 py-1 font-semibold text-stone-700 hover:text-stone-950 dark:text-stone-300 dark:hover:text-stone-100"
      onClick={onClick}
      size="sm"
      type="button"
      variant="ghost"
    >
      <span>{label}</span>
      <SortIcon sorted={sorted} />
    </Button>
  );
}

function SortIcon({ sorted }: Pick<HeaderButtonProps, "sorted">) {
  if (sorted === "asc") {
    return <ChevronUp className="size-4" />;
  }

  if (sorted === "desc") {
    return <ChevronDown className="size-4" />;
  }

  return <ChevronsUpDown className="size-4 opacity-60" />;
}

function getColumnLabel<TData>(columnDef: ColumnDef<TData>, fallback: string) {
  const meta = getColumnMeta(columnDef);
  return meta?.label ?? fallback;
}

function getColumnMeta<TData>(columnDef: ColumnDef<TData>) {
  return columnDef.meta as
    | {
        label?: string;
        mobileHidden?: boolean;
        mobileSlot?: "content" | "summary" | "footer";
      }
    | undefined;
}

export function tableCellMuted(value: string | null | undefined) {
  if (value && value.trim() !== "") {
    return value;
  }

  return <span className="text-stone-400 dark:text-stone-500">—</span>;
}

export function tableCellWrap(className?: string) {
  return cn("text-xs leading-6", className);
}

function ColumnVisibilityToggle(props: {
  id: string;
  label: string;
  visible: boolean;
  onToggle: (checked: boolean) => void;
}) {
  const inputId = useId();

  return (
    <label
      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-stone-700 hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-stone-900"
      htmlFor={inputId}
      role="menuitemcheckbox"
      aria-checked={props.visible}
    >
      <Checkbox
        checked={props.visible}
        id={inputId}
        onCheckedChange={(checked) => props.onToggle(checked === true)}
      />
      <span className="select-none">{props.label}</span>
    </label>
  );
}
