import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Integration tests against the local Postgres.
 *
 * These exist because the most important security claim in this project —
 * that one user cannot reach another's financial records — cannot be
 * established by reading policy SQL. It has to be attempted and seen to fail.
 * Everything here runs with the anon key and a real signed-in session, which
 * is exactly what a browser has.
 *
 * Requires the local stack: `npm run db:start`. The suite skips itself rather
 * than failing when the stack is not running, so `npm test` stays useful
 * without Docker.
 */

const API_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:55321";
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const PASSWORD = "integration-test-password-2026";

/**
 * The first request to the containerised gateway can take several seconds on a
 * cold stack, so the probe is generous and retried. A short timeout here made
 * the whole suite silently skip on a healthy machine, which is worse than a
 * slow check: a security test that quietly does not run is indistinguishable
 * from one that passes.
 */
async function stackIsRunning(): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${API_URL}/auth/v1/health`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) return true;
    } catch {
      // Fall through and retry.
    }
  }
  return false;
}

const available = await stackIsRunning();

interface TestUser {
  readonly client: SupabaseClient;
  readonly id: string;
  readonly email: string;
}

async function createTestUser(label: string): Promise<TestUser> {
  const client = createClient(API_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // A unique address per run, so repeated runs do not collide.
  const email = `rls-${label}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}@daylight.test`;

  const { data, error } = await client.auth.signUp({
    email,
    password: PASSWORD,
  });
  if (error) throw error;
  const id = data.user?.id;
  if (!id) throw new Error(`sign-up for ${label} returned no user`);
  return { client, id, email };
}

describe.skipIf(!available)("cross-user isolation", () => {
  let owner: TestUser;
  let intruder: TestUser;
  let categoryId: string;
  let transactionId: string;

  beforeAll(async () => {
    owner = await createTestUser("owner");
    intruder = await createTestUser("intruder");

    const { data: categories, error } = await owner.client
      .from("categories")
      .select("id, system_key")
      .eq("system_key", "groceries");
    if (error) throw error;
    expect(categories).toHaveLength(1);
    categoryId = categories![0]!.id;

    const { data: inserted, error: insertError } = await owner.client
      .from("transactions")
      .insert({
        user_id: owner.id,
        kind: "expense",
        amount_minor: "1234567",
        currency: "TRY",
        occurred_on: "2026-10-18",
        description: "Owner private record",
        category_id: categoryId,
      })
      .select("id")
      .single();
    if (insertError) throw insertError;
    transactionId = inserted!.id;
  }, 60_000);

  afterAll(async () => {
    await owner?.client.auth.signOut();
    await intruder?.client.auth.signOut();
  });

  it("creates a profile and seeded categories for a new user", async () => {
    const { data: profile } = await owner.client
      .from("profiles")
      .select("id, locale, default_currency")
      .eq("id", owner.id)
      .single();

    expect(profile?.id).toBe(owner.id);
    expect(profile?.locale).toBe("tr");
    expect(profile?.default_currency).toBe("TRY");

    const { data: categories } = await owner.client
      .from("categories")
      .select("system_key");
    expect(categories?.length).toBeGreaterThanOrEqual(9);
  });

  it("lets the owner read their own record", async () => {
    const { data } = await owner.client
      .from("transactions")
      .select("id, description")
      .eq("id", transactionId);
    expect(data).toHaveLength(1);
  });

  it("returns nothing when another user reads it", async () => {
    const { data, error } = await intruder.client
      .from("transactions")
      .select("id, description");
    // RLS filters rather than errors: the row is simply not there.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("returns nothing when another user requests it by id", async () => {
    const { data } = await intruder.client
      .from("transactions")
      .select("id")
      .eq("id", transactionId);
    expect(data).toEqual([]);
  });

  it("refuses an insert labelled with another user's id", async () => {
    const { error } = await intruder.client.from("transactions").insert({
      user_id: owner.id,
      kind: "income",
      amount_minor: "999",
      currency: "TRY",
      occurred_on: "2026-10-18",
      description: "Forged row",
    });
    // This is the WITH CHECK clause doing its job. Without it, a user could
    // plant rows in someone else's ledger.
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("cannot reassign its own row to another user", async () => {
    const { data: own } = await intruder.client
      .from("transactions")
      .insert({
        user_id: intruder.id,
        kind: "income",
        amount_minor: "100",
        currency: "TRY",
        occurred_on: "2026-10-18",
        description: "Intruder own row",
      })
      .select("id")
      .single();

    const { error } = await intruder.client
      .from("transactions")
      .update({ user_id: owner.id })
      .eq("id", own!.id);

    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("deletes nothing when another user tries to delete everything", async () => {
    await intruder.client.from("transactions").delete().gt("amount_minor", 0);

    const { data } = await owner.client
      .from("transactions")
      .select("id")
      .eq("id", transactionId);
    expect(data).toHaveLength(1);
  });

  it("cannot read another user's profile", async () => {
    const { data } = await intruder.client
      .from("profiles")
      .select("id")
      .eq("id", owner.id);
    expect(data).toEqual([]);
  });

  it("cannot attach a transaction to another user's category", async () => {
    const { error } = await intruder.client.from("transactions").insert({
      user_id: intruder.id,
      kind: "expense",
      amount_minor: "500",
      currency: "TRY",
      occurred_on: "2026-10-18",
      description: "Borrowed category",
      category_id: categoryId,
    });
    // The foreign key alone would allow this; the policy's EXISTS clause is
    // what prevents one user's row from referencing another's category.
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });
});

describe.skipIf(!available)("monetary precision through the API", () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await createTestUser("precision");
    const { error } = await user.client.from("transactions").insert({
      user_id: user.id,
      kind: "income",
      amount_minor: "9007199254740993",
      currency: "TRY",
      occurred_on: "2026-10-05",
      description: "Above Number.MAX_SAFE_INTEGER",
    });
    if (error) throw error;
  }, 60_000);

  afterAll(async () => {
    await user?.client.auth.signOut();
  });

  it("preserves the exact integer when read as text", async () => {
    const { data } = await user.client
      .from("transactions")
      .select("amount_minor::text")
      .single();

    const raw = (data as unknown as { amount_minor: string }).amount_minor;
    expect(raw).toBe("9007199254740993");
    expect(BigInt(raw)).toBe(9007199254740993n);
  });

  it("loses the last digit when read as a JSON number", async () => {
    // Documents exactly why the data access layer casts to text. If this test
    // ever starts failing, PostgREST changed its serialisation and the cast
    // may no longer be needed.
    const { data } = await user.client
      .from("transactions")
      .select("amount_minor")
      .single();

    const asNumber = (data as unknown as { amount_minor: number }).amount_minor;
    expect(asNumber).toBe(9007199254740992);
    expect(String(asNumber)).not.toBe("9007199254740993");
  });

  it("round-trips Turkish characters in a description", async () => {
    const description = "Market alışverişi — ğĞıİşŞçÇöÖüÜ";
    await user.client.from("transactions").insert({
      user_id: user.id,
      kind: "expense",
      amount_minor: "1000",
      currency: "TRY",
      occurred_on: "2026-10-06",
      description,
    });

    const { data } = await user.client
      .from("transactions")
      .select("description")
      .eq("amount_minor", 1000)
      .single();

    expect(data?.description).toBe(description);
  });
});

describe.skipIf(!available)("database-level invariants", () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await createTestUser("invariants");
  }, 60_000);

  afterAll(async () => {
    await user?.client.auth.signOut();
  });

  it("rejects a non-positive amount", async () => {
    const { error } = await user.client.from("transactions").insert({
      user_id: user.id,
      kind: "expense",
      amount_minor: "0",
      currency: "TRY",
      occurred_on: "2026-10-18",
      description: "Zero",
    });
    expect(error).not.toBeNull();
  });

  it("rejects an unknown currency", async () => {
    const { error } = await user.client.from("transactions").insert({
      user_id: user.id,
      kind: "expense",
      amount_minor: "100",
      currency: "XYZ",
      occurred_on: "2026-10-18",
      description: "Bad currency",
    });
    expect(error).not.toBeNull();
  });

  it("rejects a budget whose period does not start on the first of a month", async () => {
    const { data: categories } = await user.client
      .from("categories")
      .select("id")
      .eq("system_key", "housing");

    const { error } = await user.client.from("budgets").insert({
      user_id: user.id,
      category_id: categories![0]!.id,
      limit_minor: "100000",
      currency: "TRY",
      period_start: "2026-10-15",
    });
    expect(error).not.toBeNull();
  });

  it("rejects a goal entry in a different currency than its goal", async () => {
    const { data: goal } = await user.client
      .from("savings_goals")
      .insert({
        user_id: user.id,
        name: "Currency guard",
        target_minor: "5000000",
        currency: "TRY",
      })
      .select("id")
      .single();

    const { error } = await user.client.from("savings_goal_entries").insert({
      user_id: user.id,
      goal_id: goal!.id,
      amount_minor: "10000",
      currency: "USD",
      direction: "deposit",
    });
    // Enforced by a trigger, so it holds no matter which client writes.
    expect(error).not.toBeNull();
  });
});
