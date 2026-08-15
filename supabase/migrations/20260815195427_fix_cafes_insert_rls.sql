/*
# Fix cafes INSERT RLS policy — allow owners to create their café

## Problem
The cafes table had a single `FOR ALL` policy with
`WITH CHECK (id = current_cafe_id())`. When a new owner creates their first
café, current_cafe_id() returns NULL (no café row exists yet for this owner),
so the INSERT is blocked with "new row violates row-level security policy".

## Fix
Split the single FOR ALL policy into four verb-specific policies:
- SELECT: USING (id = current_cafe_id()) — owners can read their own café
- INSERT: WITH CHECK (owner_id = auth.uid()) — owners can create a café they own
- UPDATE: USING (id = current_cafe_id()) WITH CHECK (id = current_cafe_id())
- DELETE: USING (id = current_cafe_id())

The INSERT policy checks owner_id = auth.uid() directly (not current_cafe_id())
because the café row doesn't exist yet when the check runs.

## Tables modified
- cafes (policies only, no schema changes)

## Security
- No new tables or columns.
- RLS remains enabled on cafes.
- The INSERT policy still enforces ownership: only the authenticated owner
  can insert a row where they are the owner_id.
- SELECT/UPDATE/DELETE unchanged in effect — still scoped via current_cafe_id().
*/

-- Drop the old FOR ALL policy
DROP POLICY IF EXISTS "Cafes access" ON cafes;

-- SELECT: owners can read their own café (via current_cafe_id)
CREATE POLICY "Cafes select" ON cafes
  FOR SELECT TO authenticated
  USING (id = current_cafe_id());

-- INSERT: owners can create a café they own (owner_id must match auth.uid)
CREATE POLICY "Cafes insert" ON cafes
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- UPDATE: owners can update their own café
CREATE POLICY "Cafes update" ON cafes
  FOR UPDATE TO authenticated
  USING (id = current_cafe_id())
  WITH CHECK (id = current_cafe_id());

-- DELETE: owners can delete their own café
CREATE POLICY "Cafes delete" ON cafes
  FOR DELETE TO authenticated
  USING (id = current_cafe_id());
