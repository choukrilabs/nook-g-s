# Production Code Review — Performance-Focused Audit

Date: 2026-08-14
Stack reviewed: TypeScript, React, Vite, Supabase, Dexie, CSS
Primary concern: performance

## Findings

### 1. Open Supabase RLS policies expose every tenant's data
- **File/location:** `schema.sql:136-146`
- **Severity:** Critical
- **What's wrong:** Every table policy is `USING (true) WITH CHECK (true)`, including anonymous access. Any client with the public anon key can read, update, insert, or delete cafes, staff, sessions, products, audit logs, and client balances across all cafes.
- **Why it matters:** This is a production data breach condition. A malicious user can enumerate invite codes, read customer phone numbers and balances, modify revenue/session records, disable staff, or poison audit logs.
- **Fix it:** Replace open policies with owner-scoped policies and a secure staff authorization model. Example owner-only baseline:

```sql
DROP POLICY IF EXISTS "Allow all operations for cafes" ON cafes;
CREATE POLICY cafes_owner_all ON cafes
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Allow all operations for sessions" ON sessions;
CREATE POLICY sessions_owner_all ON sessions
  FOR ALL
  USING (
    cafe_id IN (SELECT id FROM cafes WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    cafe_id IN (SELECT id FROM cafes WHERE owner_id = auth.uid())
  );
```

For staff, do not trust localStorage. Use Supabase Auth/JWT claims or server-side RPCs that validate staff membership and permissions.

### 2. Staff authentication is client-side and bypassable
- **File/location:** `src/pages/LoginPage.tsx:123-174`, `src/pages/LoginPage.tsx:229-246`, `src/stores/authStore.ts:35-45`, `schema.sql:140-146`
- **Severity:** Critical
- **What's wrong:** The app downloads active staff records, including `pin_hash`, compares the entered PIN in the browser, then persists the staff session in localStorage. Combined with open RLS, attackers do not need to pass this UI flow, but even with stricter RLS the client-side PIN check is forgeable.
- **Why it matters:** Anyone with browser devtools can set `nook_staff_session`/Zustand persisted auth state or query `staff` directly and impersonate staff. PIN hashes are exposed to clients and can be brute-forced offline.
- **Fix it:** Move staff login to a server-side Supabase Edge Function/RPC with rate limiting. Return a signed, expiring session token or require staff to use Supabase Auth. Never expose `pin_hash` in client queries.

### 3. Project does not type-check in production state
- **File/location:** `src/components/layout/TopBar.tsx:14-15`, `src/pages/ReportsPage.tsx:441-443`
- **Severity:** High
- **What's wrong:** `npm run lint` fails. `staff.permissions` is typed as generic JSON, and `Object.values(categoryRevenue)` is inferred as `unknown[]`, so arithmetic is not type-safe.
- **Why it matters:** The repository cannot pass its own release gate. These errors hide real regressions and make CI/CD unreliable.
- **Fix it:** Define a concrete permissions type and category revenue map.

```ts
type StaffPermissions = {
  sessions?: boolean;
  reports?: boolean;
  clients?: boolean;
  settings?: boolean;
};

const permissions = staff?.permissions as StaffPermissions | undefined;
const hasSettings = type === 'owner' || !!permissions?.settings;
```

```ts
const categoryRevenue: Record<string, number> = { boisson: 0, nourriture: 0, autre: 0 };
const totalExtras = Object.values(categoryRevenue).reduce<number>((sum, value) => sum + value, 0);
```

### 4. Active sessions can leak across cafes from IndexedDB
- **File/location:** `src/hooks/useRealtime.ts:17-23`, `src/lib/offlineDB.ts:11-15`
- **Severity:** High
- **What's wrong:** Offline active sessions are loaded by `status = active` only, not by `cafe_id`. The schema has a `cafe_id` index but the query does not use it.
- **Why it matters:** On a shared device or after switching cafes/users, one cafe can see another cafe's active sessions offline. This is both a privacy bug and a correctness bug that can lead staff to close or modify the wrong cached session.
- **Fix it:** Query by a compound index or filter by `cafe_id` before setting state.

```ts
const localSessions = await db.sessions
  .where('cafe_id')
  .equals(cafe.id)
  .filter((session) => session.status === 'active')
  .reverse()
  .sortBy('started_at');
```

For better performance, add a compound Dexie index such as `[cafe_id+status+started_at]` in a schema migration.

### 5. Offline full sync leaves stale deleted/deactivated rows in cache
- **File/location:** `src/lib/offlineSync.ts:25-40`
- **Severity:** High
- **What's wrong:** `syncDataToOfflineDB` only `bulkPut`s fetched rows. It never deletes rows absent from the server result set, and product/staff queries include inactive/deleted state inconsistently across pages.
- **Why it matters:** Deactivated staff, deleted products, deleted clients, or completed sessions can remain visible and usable offline indefinitely. That can produce bad sales data and unauthorized staff access on cached devices.
- **Fix it:** Sync per cafe inside a Dexie transaction: fetch authoritative rows, compute ids to delete for that cafe/table, then bulk delete missing ids before bulkPut. Also purge local caches on logout and cafe switch.

### 6. LocalStorage JSON parsing can break app initialization
- **File/location:** `src/App.tsx:132-146`, `src/lib/offlineSync.ts:16-18`, `src/hooks/useRealtime.ts:96-103`
- **Severity:** Medium
- **What's wrong:** Several `JSON.parse` calls assume localStorage values are valid and correctly shaped. Corrupt values are common after manual debugging, browser restore bugs, extension interference, or partial writes.
- **Why it matters:** A malformed staff session or sync queue can keep users stuck at login/startup, prevent queued changes from syncing, or break realtime staff updates.
- **Fix it:** Centralize safe storage helpers that catch parse errors, validate shape, and remove corrupt keys.

```ts
function readJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}
```

### 7. Offline mutation queue is race-prone and can lose operations
- **File/location:** `src/lib/offlineSync.ts:76-86`, `src/lib/offlineSync.ts:125-198`, `src/lib/offlineSync.ts:210-216`
- **Severity:** Medium
- **What's wrong:** Queue reads/writes are plain localStorage operations. Concurrent UI actions, multiple tabs, or the online event can interleave `getQueue`/`saveQueue` and overwrite pending operations. `processSyncQueue` also has no in-flight lock.
- **Why it matters:** In production cafes, staff can have multiple tabs/devices and spotty connectivity. Lost queued operations means missing sessions, missing extras, or incorrect revenue.
- **Fix it:** Store queue records in Dexie with one row per operation and process them under a mutex/Web Lock. At minimum add an in-memory processing guard and listen to `storage` events.

### 8. Seat rendering is O(seats × activeSessions) every second
- **File/location:** `src/pages/SeatsPage.tsx:16-24`, `src/pages/SeatsPage.tsx:49-68`
- **Severity:** Medium
- **What's wrong:** The page re-renders every second and calls `activeSessions.find` for each seat. With many seats/sessions, this becomes quadratic work on a hot path.
- **Why it matters:** This is directly user-visible on tablets/low-end devices: frequent renders plus motion components will drain battery and cause jank as the cafe grows.
- **Fix it:** Precompute a `Map` by seat and reduce timer frequency to the granularity displayed, which is minutes.

```ts
const sessionsBySeat = useMemo(
  () => new Map(activeSessions.map((session) => [session.seat_number, session])),
  [activeSessions],
);

useEffect(() => {
  const timer = setInterval(() => setNow(Date.now()), 60_000);
  return () => clearInterval(timer);
}, []);
```

### 9. Product offline loading does unnecessary IndexedDB work
- **File/location:** `src/pages/NewSessionPage.tsx:100-113`
- **Severity:** Low
- **What's wrong:** The offline branch queries `db.products.where('active').equals(1).toArray()` and discards the result, then fetches all products and filters in memory.
- **Why it matters:** This adds avoidable IndexedDB reads on session creation, a high-frequency path. It also loads products for all cafes unless the local table was already perfectly scoped.
- **Fix it:** Remove the unused query and filter by `cafe_id` using the existing index.

```ts
const allProds = await db.products.where('cafe_id').equals(cafe.id).toArray();
setProducts(allProds.filter((p) => p.active).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
```

### 10. Reports recomputes category total inside each category render
- **File/location:** `src/pages/ReportsPage.tsx:436-443`
- **Severity:** Low
- **What's wrong:** `Object.values(categoryRevenue).reduce(...)` runs once per category item inside `.map`.
- **Why it matters:** The current category count is small, but this pattern scales poorly and contributes to unnecessary render work in a reporting screen that already does chart rendering.
- **Fix it:** Compute `totalExtras` once before the JSX block or with `useMemo` alongside `categoryRevenue`.

### 11. No automated tests for the money/session-critical paths
- **File/location:** `package.json:6-10`; broad gaps in `src/pages/NewSessionPage.tsx`, `src/pages/SessionDetailPage.tsx`, `src/lib/offlineSync.ts`
- **Severity:** High
- **What's wrong:** There is no test script or test framework configured. Critical billing math, offline queue semantics, permissions, and staff login behavior are untested.
- **Why it matters:** This app records real payments and customer balances. Regressions in billing minimums, extras totals, offline sync, or authorization can ship unnoticed.
- **Fix it:** Add unit tests for pure billing functions after extracting them from pages, and integration tests around `queueMutation`/`processSyncQueue` with mocked Supabase and Dexie.

### 12. Dependency audit contains critical/high vulnerabilities
- **File/location:** `package.json:12-31`, `package-lock.json`
- **Severity:** High
- **What's wrong:** `npm audit --audit-level=high` reports 20 vulnerabilities, including critical `protobufjs`, high `react-router`, high `vite`, high `postcss`, and high `ws` advisories.
- **Why it matters:** This is a production app. Even if some vulnerabilities are dev-server or transitive, the current dependency state fails a standard security gate and includes packages that affect routing/build tooling/runtime dependencies.
- **Fix it:** Run `npm audit fix`, review lockfile changes, and pin direct dependencies to patched versions. Remove unused server-side packages (`express`, `dotenv`) from a Vite client app unless there is an actual server entry point.
