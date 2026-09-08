import type { MouseEvent } from "react";
import type { PaginationState } from "@/types";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

type ServerPaginationProps = {
  pagination: PaginationState;
  disabled?: boolean;
  onNavigate: (url: string) => void;
};

export function ServerPagination({ pagination, disabled = false, onNavigate }: ServerPaginationProps) {
  const visiblePages = compactPages(pagination);
  const hasNavigation = pagination.total_pages > 1 || pagination.previous_url || pagination.next_url;
  if (!hasNavigation) return null;

  function navigate(event: MouseEvent<HTMLAnchorElement>, url: string | null) {
    event.preventDefault();
    if (!disabled && url) onNavigate(url);
  }

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone-200/70 pt-3 dark:border-stone-800">
      <span className="text-xs text-stone-500 dark:text-stone-400">
        第 {pagination.current_page} / {pagination.total_pages} 页
      </span>
      <Pagination className="mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              aria-disabled={disabled || !pagination.previous_url}
              className={cn((disabled || !pagination.previous_url) && "pointer-events-none opacity-50")}
              href={pagination.previous_url ?? "#"}
              onClick={(event) => navigate(event, pagination.previous_url)}
            />
          </PaginationItem>
          {visiblePages.map((entry, index) =>
            entry === null ? (
              <PaginationItem key={`ellipsis-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={entry.page}>
                <PaginationLink
                  aria-disabled={disabled || entry.page === pagination.current_page}
                  className={cn((disabled || entry.page === pagination.current_page) && "pointer-events-none", disabled && "opacity-50")}
                  href={entry.url}
                  isActive={entry.page === pagination.current_page}
                  onClick={(event) => navigate(event, entry.url)}
                >
                  {entry.page}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <PaginationNext
              aria-disabled={disabled || !pagination.next_url}
              className={cn((disabled || !pagination.next_url) && "pointer-events-none opacity-50")}
              href={pagination.next_url ?? "#"}
              onClick={(event) => navigate(event, pagination.next_url)}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

function compactPages(pagination: PaginationState) {
  const pages = pagination.pages;
  if (pages.length <= 5) return pages;
  const keep = new Set([1, pagination.total_pages, pagination.current_page - 1, pagination.current_page, pagination.current_page + 1]);
  const selected = pages.filter((entry) => keep.has(entry.page));
  const result: Array<(typeof pages)[number] | null> = [];
  for (const entry of selected) {
    const previous = result.at(-1);
    if (previous && entry.page > previous.page + 1) result.push(null);
    result.push(entry);
  }
  return result;
}
