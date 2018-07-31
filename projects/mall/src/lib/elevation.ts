import { BehaviorSubject, Observable } from 'rxjs';
import { take, switchMap } from 'rxjs/operators';

export interface ElevationQueryParams {
  where?: { [propName: string]: string };
  collection?: string;
  orderBy?: string;
  limit?: number;
}

export class Elevation {
  private _loading = new BehaviorSubject(false);
  private _items = new BehaviorSubject([]);
  private _done = new BehaviorSubject(false);

  loading: Observable<boolean> = this._loading.asObservable();
  items: BehaviorSubject<any> = new BehaviorSubject([]);
  done: Observable<boolean> = this._done.asObservable();

  queryParams: BehaviorSubject<ElevationQueryParams> = new BehaviorSubject({ });

  constructor(private elevator, params: ElevationQueryParams) {
    this.reevaluate(params);
    this.update();
  }

  reevaluate(params) {
    this._done.next(false);
    this._items.next([]);
    this.items.next([]);
    this.queryParams.next(Object.assign(this.queryParams.value || {}, params));
  }

  more(amount?) {
    this.update(true, amount);
  }

  private cursor() {
    const current = this._items.value;

    if (current.length) {
      return current[current.length - 1].doc;
    }

    return null;
  }

  private query(next?, _limit?) {
    return this.queryParams.pipe(switchMap(({ collection, limit, where, orderBy }) => {
      return this.elevator.mall.collection(collection, ref => {
        let query = ref;

        if (orderBy) {
          query = query.orderBy(orderBy);
        }

        if (next && this.cursor()) {
          query = query.startAfter(this.cursor());
        }

        if (where) {
          Object.keys(where).forEach(key => {
            if (where[key]) {
              query = query.where(key, '==', where[key]);
            }
          });
        }

        if (limit) {
          // TODO some math to always reach right limit
          query = query.limit(_limit || limit);
        }

        return query;
      }).pipe(take(1));
    }));
  }

  private scan(values) {
    this._items.next(values);
    this.items.next([...this.items.value, ...values]);
  }

  private update(next?, amount?) {
    if (this._done.value || this._loading.value) { return; }
    this._loading.next(true);
    let limit = this.queryParams.value.limit;

    if (amount) {
      limit = Math.floor(limit * (1 + amount));
    }

    const col = this.query(next, limit);

    col.subscribe((values: any) => {
      if (values.length) {
        if (values.length < limit) {
          this._done.next(true);
        }
        this.scan(values);
      } else {
        this._done.next(true);
      }

      this._loading.next(false);
    });
  }

}
