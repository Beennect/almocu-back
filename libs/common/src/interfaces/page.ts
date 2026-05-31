export class Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;

  constructor(
    items: T[],
    total: number,
    pageable: { page: number; limit: number },
  ) {
    this.items = items;
    this.total = total;
    this.page = pageable.page;
    this.limit = pageable.limit;
    this.pages = Math.ceil(total / pageable.limit);
  }
}
