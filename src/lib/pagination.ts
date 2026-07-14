/** Default and maximum page sizes for list queries. */
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export type PaginationParams = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

/**
 * Parse `?page=1&pageSize=50` from a URL. Clamps pageSize to MAX_PAGE_SIZE.
 */
export function parsePagination(
  searchParams: URLSearchParams,
  defaultSize = DEFAULT_PAGE_SIZE
): PaginationParams {
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(searchParams.get("pageSize")) || defaultSize)
  );
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function paginated<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number
): PaginatedResult<T> {
  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
