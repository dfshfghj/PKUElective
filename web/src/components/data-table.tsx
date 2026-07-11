import type { ReactNode } from "react";
import { useId, useState } from "react";
import type { ColumnDef, SortingState, VisibilityState } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ChevronsUpDown, Columns3 } from "lucide-react";

import { useIsMobile } from "@/hooks/use-mobile";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  const [showColumnPanel, setShowColumnPanel] = useState(false);
  const isMobile = useIsMobile();

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-stone-500 dark:text-stone-400">
          {table.getRowModel().rows.length} 条结果
        </div>
        {hideableColumns.length > 0 ? (
          <Button
            className="gap-2"
            onClick={() => setShowColumnPanel((current) => !current)}
            size="sm"
            type="button"
            variant="outline"
          >
            <Columns3 className="size-4" />
            显示字段
          </Button>
        ) : null}
      </div>

      {showColumnPanel ? (
        <div className="grid gap-3 rounded-2xl border border-stone-200/80 bg-stone-50/80 p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900/70">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400">
            列显示设置
          </div>
          <div className="flex flex-wrap gap-3">
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

      {isMobile ? (
        table.getRowModel().rows.length > 0 ? (
          <div className="grid gap-4">
            {table.getRowModel().rows.map((row) => {
              const visibleCells = row.getVisibleCells();
              const contentCells = visibleCells.filter((cell) => {
                const meta = getColumnMeta(cell.column.columnDef);
                return !meta?.mobileHidden && meta?.mobileSlot !== "footer";
              });
              const footerCells = visibleCells.filter((cell) => {
                const meta = getColumnMeta(cell.column.columnDef);
                return !meta?.mobileHidden && meta?.mobileSlot === "footer";
              });

              return (
                <Card
                  key={row.id}
                  className="overflow-hidden rounded-3xl border border-stone-900/8 bg-white/90 shadow-sm dark:border-stone-800 dark:bg-stone-950/80"
                >
                  <CardHeader className="gap-3 border-b border-stone-200/70 pb-4 dark:border-stone-800">
                    <div className="space-y-1">
                      {mobileCardTitle ? (
                        <CardTitle className="text-lg text-stone-950 dark:text-stone-100">
                          {mobileCardTitle(row.original)}
                        </CardTitle>
                      ) : null}
                      {mobileCardDescription ? (
                        <CardDescription className="text-sm leading-6 text-stone-500 dark:text-stone-400">
                          {mobileCardDescription(row.original)}
                        </CardDescription>
                      ) : null}
                    </div>
                    {mobileCardBadges ? (
                      <div className="flex flex-wrap gap-2">{mobileCardBadges(row.original)}</div>
                    ) : null}
                  </CardHeader>
                  <CardContent className="grid gap-3 pt-4">
                    {contentCells.map((cell) => {
                      const label = getColumnLabel(cell.column.columnDef, cell.column.id);
                      return (
                        <div
                          key={cell.id}
                          className="grid gap-2 rounded-2xl bg-stone-50/80 px-4 py-3 dark:bg-stone-900/80"
                        >
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400">
                            {label}
                          </div>
                          <div className="text-sm leading-6 text-stone-800 dark:text-stone-200">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                  {footerCells.length > 0 ? (
                    <CardFooter className="flex-col items-stretch gap-3 border-t border-stone-200/70 bg-stone-50/80 dark:border-stone-800 dark:bg-stone-900/80">
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
          <div className="rounded-3xl border border-stone-900/8 bg-white/80 px-4 py-10 text-center text-sm text-stone-500 dark:border-stone-800 dark:bg-stone-950/80 dark:text-stone-400">
            {emptyText}
          </div>
        )
      ) : (
        <div className="overflow-hidden rounded-3xl border border-stone-900/8 dark:border-stone-800">
          <Table className="bg-white/80 dark:bg-stone-950/80">
            <TableHeader className="bg-stone-100/90 dark:bg-stone-900">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="px-2 py-3 font-semibold text-stone-700 dark:text-stone-300"
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
                      <TableCell key={cell.id} className="px-2 py-2 align-top text-center align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
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
        </div>
      )}
    </div>
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
        mobileSlot?: "content" | "footer";
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
    <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200">
      <Checkbox
        checked={props.visible}
        id={inputId}
        onCheckedChange={(checked) => props.onToggle(checked === true)}
      />
      <label className="cursor-pointer select-none" htmlFor={inputId}>
        {props.label}
      </label>
    </div>
  );
}
