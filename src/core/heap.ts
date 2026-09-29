/** Minimal binary max-heap keyed by a numeric priority (FIFO among equals). */
export class MaxHeap<T> {
  private readonly items: { value: T; priority: number; order: number }[] = [];
  private counter = 0;

  public get size(): number {
    return this.items.length;
  }

  public push(value: T, priority: number): void {
    this.items.push({ value, priority, order: this.counter });
    this.counter += 1;
    this.siftUp(this.items.length - 1);
  }

  public pop(): T | undefined {
    const top = this.items[0];
    const last = this.items.pop();
    if (top === undefined || last === undefined) {
      return undefined;
    }
    if (this.items.length > 0) {
      this.items[0] = last;
      this.siftDown(0);
    }
    return top.value;
  }

  private before(a: number, b: number): boolean {
    const x = this.items[a];
    const y = this.items[b];
    return x.priority > y.priority || (x.priority === y.priority && x.order < y.order);
  }

  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
  }

  private siftUp(index: number): void {
    let i = index;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.before(i, parent)) {
        return;
      }
      this.swap(i, parent);
      i = parent;
    }
  }

  private siftDown(index: number): void {
    let i = index;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let best = i;
      if (left < this.items.length && this.before(left, best)) {
        best = left;
      }
      if (right < this.items.length && this.before(right, best)) {
        best = right;
      }
      if (best === i) {
        return;
      }
      this.swap(i, best);
      i = best;
    }
  }
}
