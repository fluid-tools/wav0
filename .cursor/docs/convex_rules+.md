# Convex Architecture Spec for TypeScript Agents

> A mechanical guide for AI agents and developers building with Convex.

---

## 0. Philosophy: Why Convex Feels "Wrong" (And Why That's Right)

Convex intentionally constrains you. When something feels like an anti-pattern, it's usually Convex telling you to rethink the approach.

### The Intentional Friction

| What feels wrong | What Convex is telling you |
|------------------|---------------------------|
| "I can't use `.filter()` on queries" | Define an index. Queries should be O(log n), not O(n). |
| "Actions can't access `ctx.db`" | Side effects and transactions don't mix. Route through mutations. |
| "My mutation keeps failing with OCC errors" | You're writing too often to the same document. Redesign your data model or use Workpool. |
| "I can't call `fetch()` in a mutation" | Mutations must be deterministic. Schedule an action instead. |
| "Queries re-run on every document change" | You're collecting too much data. Narrow your index or denormalize. |
| "I can't do joins" | Denormalize. Embed related data or use lookup tables. |

### Core Invariants

1. **Mutations are ACID transactions** — All writes succeed together or fail together.
2. **Queries are reactive** — They re-run when any read document changes.
3. **Actions are non-transactional orchestration** — No reactivity, no `ctx.db`. Can do external I/O and must call queries/mutations via `ctx.run*`.
4. **Scheduling is atomic with mutations** — If mutation fails, scheduled functions don't run.

---

## 1. Core Mental Model

Everything in Convex falls into:

| Kind | Visibility | Purpose |
|------|------------|---------|
| `query` | public | Read from DB, reactive subscriptions |
| `mutation` | public | Write to DB, ACID transactions |
| `action` | public | External APIs, non-deterministic work |
| `httpAction` | public (HTTP) | Webhooks, third-party integrations |
| `internalQuery` | private | Read primitives for internal use |
| `internalMutation` | private | Write primitives for internal use |
| `internalAction` | private | Orchestration, external calls |

**Rule: Export a thin public surface. All real logic lives in internal primitives.**

> `internal*` variants have identical execution semantics to their public counterparts. The only difference is visibility — internal functions appear on `internal.*`, not `api.*`, and cannot be called from clients.

---

## 2. Layered Architecture

### Layer 1: Client Surface

Only entrypoints live here. Thin wrappers that validate, auth-check, and delegate.

```typescript
// convex/jobs.ts — PUBLIC SURFACE
import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { internal } from "./_generated/api"

// Public mutation: client entrypoint
export const startGeneration = mutation({
  args: { prompt: v.string() },
  returns: v.id("jobs"),
  handler: async (ctx, args) => {
    // 1. Auth check
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthorized")

    // 2. Delegate to internal mutation
    const jobId = await ctx.runMutation(internal.jobs.createJob, {
      userId: identity.subject,
      prompt: args.prompt,
    })

    // 3. Schedule background work
    await ctx.scheduler.runAfter(0, internal.jobs.processJob, { jobId })

    return jobId
  },
})

// Public query: reactive subscription
export const getJob = query({
  args: { jobId: v.id("jobs") },
  returns: v.union(
    v.object({
      _id: v.id("jobs"),
      _creationTime: v.number(),
      status: v.string(),
      prompt: v.string(),
      result: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId)
  },
})
```

### Layer 2: Domain Logic (Internal Primitives)

Where the real logic lives. These are your backend's private API.

```typescript
// convex/jobs.ts — INTERNAL PRIMITIVES (same file, different exports)

export const createJob = internalMutation({
  args: {
    userId: v.string(),
    prompt: v.string(),
  },
  returns: v.id("jobs"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("jobs", {
      userId: args.userId,
      prompt: args.prompt,
      status: "pending",
    })
  },
})

export const markComplete = internalMutation({
  args: {
    jobId: v.id("jobs"),
    result: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "completed",
      result: args.result,
    })
    return null
  },
})

export const markFailed = internalMutation({
  args: {
    jobId: v.id("jobs"),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "failed",
      error: args.error,
    })
    return null
  },
})
```

### Layer 3: Orchestration (Actions + Scheduler)

For multi-step, external, or long-running work.

```typescript
// convex/jobs.ts — ORCHESTRATION

export const processJob = internalAction({
  args: { jobId: v.id("jobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    // 1. Read current state
    const job = await ctx.runQuery(internal.jobs.getById, { jobId: args.jobId })
    if (!job || job.status !== "pending") return null

    try {
      // 2. External API call (non-deterministic)
      const result = await fetch("https://api.example.com/generate", {
        method: "POST",
        body: JSON.stringify({ prompt: job.prompt }),
      })
      const data = await result.json()

      // 3. Write result via mutation
      await ctx.runMutation(internal.jobs.markComplete, {
        jobId: args.jobId,
        result: data.output,
      })
    } catch (e) {
      await ctx.runMutation(internal.jobs.markFailed, {
        jobId: args.jobId,
        error: String(e),
      })
    }

    return null
  },
})

export const getById = internalQuery({
  args: { jobId: v.id("jobs") },
  returns: v.union(
    v.object({
      _id: v.id("jobs"),
      _creationTime: v.number(),
      userId: v.string(),
      prompt: v.string(),
      status: v.string(),
      result: v.optional(v.string()),
      error: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId)
  },
})
```

---

## 3. HTTP Actions (Webhooks)

Must be in `convex/http.ts` with `httpRouter`:

```typescript
// convex/http.ts
import { httpRouter } from "convex/server"
import { httpAction } from "./_generated/server"
import { internal } from "./_generated/api"

const http = httpRouter()

http.route({
  path: "/webhooks/stripe",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    // 1. Validate signature
    const signature = req.headers.get("stripe-signature")
    if (!signature) {
      return new Response("Missing signature", { status: 401 })
    }

    // 2. Parse body
    const body = await req.text()

    // 3. Delegate to internal mutation
    await ctx.runMutation(internal.billing.handleStripeWebhook, {
      signature,
      body,
    })

    return new Response(null, { status: 200 })
  }),
})

export default http
```

---

## 4. Performance Patterns

### 4.1 Denormalization

Convex has no joins. Denormalize aggressively.

```typescript
// ❌ BAD: N+1 queries
export const getTeamWithMembers = query({
  args: { teamId: v.id("teams") },
  returns: v.null(), // simplified
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId)
    // This triggers N additional reads, each causing re-renders
    const members = await Promise.all(
      team.memberIds.map(id => ctx.db.get(id))
    )
    return { team, members }
  },
})

// ✅ GOOD: Denormalize member info into team
// Schema: teams.members: v.array(v.object({ userId, name, avatar }))
export const getTeamWithMembers = query({
  args: { teamId: v.id("teams") },
  returns: v.null(),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.teamId) // Single read, includes members
  },
})
```

### 4.2 Denormalized Counts

Never `.collect()` just to count.

```typescript
// ❌ BAD: Unbounded read
const messages = await ctx.db
  .query("messages")
  .withIndex("by_channel", q => q.eq("channelId", channelId))
  .collect()
const count = messages.length

// ✅ GOOD: Show "99+" pattern
const messages = await ctx.db
  .query("messages")
  .withIndex("by_channel", q => q.eq("channelId", channelId))
  .take(100)
const count = messages.length === 100 ? "99+" : messages.length

// ✅ BEST: Denormalized counter table
// Maintain a separate "channelStats" table with messageCount field
// Update it in the same mutation that inserts messages
const stats = await ctx.db
  .query("channelStats")
  .withIndex("by_channel", q => q.eq("channelId", channelId))
  .unique()
const count = stats?.messageCount ?? 0
```

### 4.3 Index Design

Indexes are prefix-searchable. Design compound indexes to serve multiple queries.

```typescript
// Schema
export default defineSchema({
  messages: defineTable({
    channelId: v.id("channels"),
    authorId: v.id("users"),
    content: v.string(),
    isDeleted: v.boolean(),
  })
    // ✅ This single index serves THREE query patterns:
    // 1. All messages in channel: .eq("channelId", id)
    // 2. Messages by author in channel: .eq("channelId", id).eq("authorId", id)
    // 3. Non-deleted messages by author: .eq("channelId", id).eq("authorId", id).eq("isDeleted", false)
    .index("by_channel_author_deleted", ["channelId", "authorId", "isDeleted"])
})

// ❌ REDUNDANT: Don't create by_channel if you have by_channel_author_deleted
// The compound index can serve channel-only queries by partial prefix match
```

**Index naming convention:** Include all fields: `by_field1_and_field2_and_field3`

### 4.4 Avoiding Filter

Never use `.filter()`. Use indexes or filter in TypeScript.

```typescript
// ❌ BAD: filter() scans entire table
const activeUsers = await ctx.db
  .query("users")
  .filter(q => q.eq(q.field("status"), "active"))
  .collect()

// ✅ GOOD: Index-based
const activeUsers = await ctx.db
  .query("users")
  .withIndex("by_status", q => q.eq("status", "active"))
  .collect()

// ✅ ACCEPTABLE: Small dataset, complex filter
const allUsers = await ctx.db.query("users").collect() // Only if bounded!
const filtered = allUsers.filter(u => u.status === "active" && u.role !== "bot")
```

### 4.5 Denormalized Boolean Fields for Complex Filters

When you need to filter by computed conditions, denormalize the result:

```typescript
// Schema
export default defineSchema({
  posts: defineTable({
    body: v.string(),
    tags: v.array(v.string()),
    // Denormalized: computed on write
    isImportant: v.boolean(),
  }).index("by_important", ["isImportant"])
})

// Mutation: compute on write
export const createPost = mutation({
  args: { body: v.string(), tags: v.array(v.string()) },
  returns: v.id("posts"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("posts", {
      body: args.body,
      tags: args.tags,
      isImportant: args.tags.includes("important"), // Denormalize!
    })
  },
})

// Query: O(log n) lookup
export const getImportantPosts = query({
  args: {},
  returns: v.array(v.object({ /* ... */ })),
  handler: async (ctx) => {
    return await ctx.db
      .query("posts")
      .withIndex("by_important", q => q.eq("isImportant", true))
      .collect()
  },
})
```

---

## 5. Concurrency & OCC (Optimistic Concurrency Control)

Convex uses OCC for transactions. When two mutations read and write the same document simultaneously, one will be retried automatically.

### Problem: Hot Spots

```typescript
// ❌ BAD: Counter that's always conflicting
export const incrementCounter = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const counter = await ctx.db.query("counters").unique()
    await ctx.db.patch(counter!._id, { count: counter!.count + 1 })
    return null
  },
})
// If 100 users click at once, 99 will retry → cascading OCC errors
```

### Solution 1: Sharding

Split hot data across multiple documents:

```typescript
// Schema: counters table with shardId field
// On write: pick random shard
const shardId = Math.floor(Math.random() * 10)
await ctx.db.insert("counterShards", { shardId, delta: 1 })

// On read: sum all shards
const shards = await ctx.db.query("counterShards").collect()
const total = shards.reduce((sum, s) => sum + s.delta, 0)
```

### Solution 2: Workpool (convex-helpers)

Serialize writes to avoid conflicts:

```typescript
import { Workpool } from "@convex-dev/workpool"
import { components } from "./_generated/api"

const counterPool = new Workpool(components.counterWorkpool, {
  maxParallelism: 1, // Serialize all counter updates
})

export const incrementCounter = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await counterPool.enqueueMutation(ctx, internal.counters.doIncrement, {})
    return null
  },
})
```

### When to Use Workpool vs Scheduler

- Use `ctx.scheduler` for one-off background jobs with no coordination needs.
- Use Workpool when you need concurrency control, fan-out parallelism, or serialization to avoid OCC conflicts.

### Solution 3: Use Aggregate Component

For counts/sums, use the Convex Aggregate component:

```typescript
import { Aggregate } from "@convex-dev/aggregate"

// Atomic increments without OCC conflicts
await aggregate.insert(ctx, "pageViews", 1)
const total = await aggregate.sum(ctx)
```

---

## 6. Transaction Boundaries

### Consolidate Reads

Multiple `ctx.runQuery` calls in an action are NOT transactional:

```typescript
// ❌ BAD: Race condition between queries
const team = await ctx.runQuery(internal.teams.getTeam, { teamId })
const owner = await ctx.runQuery(internal.users.getUser, { userId: team.ownerId })
// Owner might have changed between the two queries!

// ✅ GOOD: Single transactional query
const teamWithOwner = await ctx.runQuery(internal.teams.getTeamWithOwner, { teamId })
```

### Batch Writes

Multiple mutations in an action are NOT atomic:

```typescript
// ❌ BAD: Partial failure possible
for (const user of users) {
  await ctx.runMutation(internal.users.insert, { user })
}

// ✅ GOOD: Single transaction
await ctx.runMutation(internal.users.insertBatch, { users })
```

> Think of each mutation as a single atomic "step." Actions may call multiple mutations, but each should represent one coherent state transition.

---

## 7. Scheduling Patterns

### Fire-and-Forget

```typescript
// Mutation schedules action, returns immediately
export const submitJob = mutation({
  args: { data: v.string() },
  returns: v.id("jobs"),
  handler: async (ctx, args) => {
    const jobId = await ctx.db.insert("jobs", { data: args.data, status: "pending" })
    await ctx.scheduler.runAfter(0, internal.jobs.process, { jobId })
    return jobId
  },
})
```

### Delayed Execution

```typescript
// Self-destructing message
export const sendExpiringMessage = mutation({
  args: { body: v.string() },
  returns: v.id("messages"),
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("messages", { body: args.body })
    await ctx.scheduler.runAfter(5000, internal.messages.delete, { id }) // 5 seconds
    return id
  },
})
```

### Cron Jobs

```typescript
// convex/crons.ts
import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()

crons.interval("cleanup stale jobs", { hours: 1 }, internal.jobs.cleanupStale, {})
crons.cron("daily report", "0 9 * * *", internal.reports.generateDaily, {})

export default crons
```

---

## 8. Model Layer Pattern

Extract business logic into reusable model functions. Functions stay thin; models do the work.

### Why Model Layer?

1. **Reuse** — Same logic across queries, mutations, actions
2. **Testability** — Pure functions, easy to unit test
3. **Separation** — Auth checks in one place, business logic in another
4. **Type Safety** — `QueryCtx` and `MutationCtx` types for context

### Pattern: Model Functions

```typescript
// convex/model/users.ts — MODEL LAYER
import { QueryCtx, MutationCtx } from "../_generated/server"
import { Id, Doc } from "../_generated/dataModel"

// Read helper: reusable across queries
export async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error("Unauthorized")

  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", q => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique()

  if (!user) throw new Error("User not found")
  return user
}

// Access control helper
export async function ensureHasAccess(
  ctx: QueryCtx,
  { conversationId }: { conversationId: Id<"conversations"> }
) {
  const user = await getCurrentUser(ctx)
  const conversation = await ctx.db.get(conversationId)

  if (!conversation || !conversation.members.includes(user._id)) {
    throw new Error("Unauthorized")
  }
  return { user, conversation }
}

// Write helper: encapsulates business logic
export async function addMessage(
  ctx: MutationCtx,
  { conversationId, content }: { conversationId: Id<"conversations">; content: string }
) {
  const { user, conversation } = await ensureHasAccess(ctx, { conversationId })

  const messageId = await ctx.db.insert("messages", {
    conversationId,
    authorId: user._id,
    content,
    createdAt: Date.now(),
  })

  // Update denormalized lastMessageAt
  await ctx.db.patch(conversationId, { lastMessageAt: Date.now() })

  return messageId
}
```

### Pattern: Thin Function Wrappers

```typescript
// convex/conversations.ts — THIN WRAPPERS
import * as Conversations from "./model/conversations"
import * as Users from "./model/users"

// Query: delegates to model
export const listMessages = query({
  args: { conversationId: v.id("conversations") },
  returns: v.array(/* ... */),
  handler: async (ctx, args) => {
    return Conversations.listMessages(ctx, args)
  },
})

// Mutation: delegates to model
export const sendMessage = mutation({
  args: { conversationId: v.id("conversations"), content: v.string() },
  returns: v.id("messages"),
  handler: async (ctx, args) => {
    return Conversations.addMessage(ctx, args)
  },
})

// Internal: same pattern
export const addSummary = internalMutation({
  args: { conversationId: v.id("conversations"), summary: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await Conversations.addSummary(ctx, args)
    return null
  },
})
```

---

## 9. Convex Helpers Library

`convex-helpers` provides battle-tested patterns. Install:

```bash
npm install convex-helpers @convex-dev/workpool
```

### Key Patterns

| Pattern | Use Case |
|---------|----------|
| **Workpool** | Fan-out parallel jobs, serialize conflicting mutations |
| **Triggers** | Run code automatically on document changes |
| **Row-Level Security** | Declarative access control |
| **Migrations** | Schema migrations with state tracking |
| **Rate Limiter** | Application-level rate limiting |
| **Relationships** | Helper functions for traversing relations |
| **Custom Functions** | Wrap queries/mutations with auth, RLS, logging |

### 9.1 Triggers (Automatic Side Effects)

Run code automatically when documents change. Triggers execute atomically within the same transaction.

> ⚠️ **Triggers run inside the same transaction as the mutation.** Writing to hot-spot documents (e.g., global counters) inside triggers will cause OCC conflicts under load. Use sharding or Workpool for high-contention writes.

```typescript
// convex/functions.ts
import { mutation as rawMutation } from "./_generated/server"
import { Triggers } from "convex-helpers/server/triggers"
import { customCtx, customMutation } from "convex-helpers/server/customFunctions"

const triggers = new Triggers<DataModel>()

// 1. Compute fullName on every user change
triggers.register("users", async (ctx, change) => {
  if (change.newDoc) {
    const fullName = `${change.newDoc.firstName} ${change.newDoc.lastName}`
    if (change.newDoc.fullName !== fullName) {
      await ctx.db.patch(change.id, { fullName })
    }
  }
})

// 2. Keep denormalized count (careful: single doc = write contention)
triggers.register("users", async (ctx, change) => {
  const countDoc = (await ctx.db.query("userCount").unique())!
  if (change.operation === "insert") {
    await ctx.db.patch(countDoc._id, { count: countDoc.count + 1 })
  } else if (change.operation === "delete") {
    await ctx.db.patch(countDoc._id, { count: countDoc.count - 1 })
  }
})

// 3. Cascading deletes
triggers.register("users", async (ctx, change) => {
  if (change.operation === "delete") {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_author", q => q.eq("authorId", change.id))
      .collect()
    for (const msg of messages) {
      await ctx.db.delete(msg._id)
    }
  }
})

// Export wrapped mutation that runs triggers
export const mutation = customMutation(rawMutation, customCtx(triggers.wrapDB))
```

### 9.2 Row-Level Security (RLS)

Declarative access control at the database layer:

```typescript
// convex/functions.ts
import { Rules, wrapDatabaseReader, wrapDatabaseWriter } from "convex-helpers/server/rowLevelSecurity"
import { customCtx, customQuery, customMutation } from "convex-helpers/server/customFunctions"

async function rlsRules(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity()
  return {
    users: {
      read: async (_, user) => {
        // Unauthenticated users can only read users over 18
        if (!identity && user.age < 18) return false
        return true
      },
      insert: async () => true,
      modify: async (_, user) => {
        if (!identity) throw new Error("Must be authenticated")
        // Users can only modify their own record
        return user.tokenIdentifier === identity.tokenIdentifier
      },
    },
    messages: {
      read: async (_, message) => {
        // Only read messages in conversations you're a member of
        const conversation = await ctx.db.get(message.conversationId)
        return conversation?.members.includes(identity?.subject ?? "") ?? false
      },
      modify: async (_, message) => {
        // Only modify your own messages
        return message.authorId === identity?.subject
      },
    },
  } satisfies Rules<QueryCtx, DataModel>
}

// Wrap query/mutation with RLS
export const queryWithRLS = customQuery(
  query,
  customCtx(async (ctx) => ({
    db: wrapDatabaseReader(ctx, ctx.db, await rlsRules(ctx)),
  }))
)

export const mutationWithRLS = customMutation(
  mutation,
  customCtx(async (ctx) => ({
    db: wrapDatabaseWriter(ctx, ctx.db, await rlsRules(ctx)),
  }))
)
```

### 9.3 Relationship Helpers

Simplify traversing relationships without manual lookups:

```typescript
import {
  getAll,
  getOneFrom,
  getManyFrom,
  getManyVia,
} from "convex-helpers/server/relationships"

// One-to-one via back reference
const profile = await getOneFrom(ctx.db, "profiles", "userId", user._id)

// One-to-many direct lookup (load multiple by IDs)
const users = await getAll(ctx.db, userIds)

// One-to-many via index (posts by author)
const posts = await getManyFrom(ctx.db, "posts", "by_authorId", author._id)

// Many-to-many via join table
const categories = await getManyVia(
  ctx.db,
  "postCategories", // join table
  "categoryId",     // field pointing to target
  "postId",         // field pointing to source
  post._id          // source ID
)
```

### 9.4 Custom Functions (Auth Wrappers)

Create reusable function wrappers with built-in auth:

```typescript
import { customQuery, customMutation } from "convex-helpers/server/customFunctions"

// Query that requires authentication
export const authedQuery = customQuery(query, {
  args: {},
  input: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthorized")

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", q => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique()
    if (!user) throw new Error("User not found")

    return { ctx: { ...ctx, user }, args }
  },
})

// Use it everywhere
export const getMyProfile = authedQuery({
  args: {},
  returns: v.object({ /* ... */ }),
  handler: async (ctx, args) => {
    // ctx.user is guaranteed to exist
    return ctx.user
  },
})
```

---

## 10. Validator Requirements

**Every function MUST have `returns` validator:**

```typescript
// ❌ WRONG: Missing returns
export const foo = mutation({
  args: {},
  handler: async (ctx) => {
    // implicitly returns undefined
  },
})

// ✅ CORRECT: Explicit v.null()
export const foo = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    return null
  },
})
```

### Common Validators

```typescript
import { v } from "convex/values"

v.string()
v.number()
v.boolean()
v.null()
v.int64()                    // NOT v.bigint() (deprecated)
v.id("tableName")
v.array(v.string())
v.object({ key: v.string() })
v.record(v.string(), v.number())
v.union(v.string(), v.null())
v.optional(v.string())
v.literal("active")
```

### TypeScript Types

```typescript
import { Doc, Id } from "./_generated/dataModel"

type User = Doc<"users">
type UserId = Id<"users">

// For records with Id keys
const map: Record<Id<"users">, string> = {}
```

---

## 11. File Structure

Flat-first. Convex uses file-based routing:

```
convex/
  schema.ts              # Database schema
  http.ts                # HTTP actions (webhooks)
  auth.ts                # Auth helpers
  crons.ts               # Cron job definitions

  # Domain files (public + internal in same file)
  users.ts               # api.users.* + internal.users.*
  jobs.ts
  billing.ts
  audio.ts

  # Model layer (business logic)
  model/
    users.ts             # User business logic helpers
    conversations.ts     # Conversation logic
    billing.ts           # Billing logic

  # Shared utilities (NOT Convex functions)
  _lib/
    validators.ts        # Shared validators
    constants.ts         # Constants
```

**Routing:**
- `convex/users.ts` → `api.users.functionName` / `internal.users.functionName`
- `convex/audio/stems.ts` → `api.audio.stems.functionName`
- `convex/model/*.ts` → NOT routed (helper imports only)

---

## 12. Rules for Agents

### MUST

1. Include `returns` validator on ALL functions (use `v.null()` when void)
2. Use `withIndex()` instead of `.filter()` for queries
3. Use `internal*` for private functions
4. Put external API calls in actions, not mutations
5. Add `"use node";` at top of files using Node.js modules
6. Use `Id<"tableName">` type, not `string`, for document IDs
7. Return `null` explicitly when handler returns nothing
8. Put HTTP actions in `convex/http.ts` with `httpRouter`
9. Index names must include all fields: `by_field1_and_field2`

### MUST NOT

1. Use `.filter()` on database queries
2. Call `fetch()` or external APIs in mutations
3. Access `ctx.db` in actions
4. Create redundant indexes (compound indexes serve prefix queries)
5. Use `.collect()` on unbounded result sets
6. Use `v.bigint()` (deprecated, use `v.int64()`)
7. Loop `ctx.runMutation` calls (use batch mutations instead)
8. Use actions as query replacements (lose reactivity)

### SHOULD

1. Denormalize data to avoid N+1 patterns
2. Use Workpool for high-contention writes
3. Batch mutations instead of looping
4. Consolidate related reads into single queries
5. Use `take(n)` with reasonable limits
6. Design indexes to serve multiple query patterns
7. Extract business logic into model layer (`convex/model/*.ts`)
8. Use `convex-helpers` for triggers, RLS, relationships
9. Add idempotency keys for non-idempotent operations
10. Use jitter when implementing retry logic

---

## 13. Quick Reference

### Function Types

```typescript
// Public (client-callable)
import { query, mutation, action } from "./_generated/server"

// Private (internal only)
import { internalQuery, internalMutation, internalAction } from "./_generated/server"

// HTTP
import { httpAction } from "./_generated/server"
import { httpRouter } from "convex/server"
```

### Function References

```typescript
import { api, internal } from "./_generated/api"

// Public: api.fileName.functionName
await ctx.runQuery(api.users.getUser, { userId })

// Internal: internal.fileName.functionName
await ctx.runMutation(internal.jobs.createJob, { data })
```

### Scheduling

```typescript
// Immediate (0ms delay)
await ctx.scheduler.runAfter(0, internal.jobs.process, { jobId })

// Delayed
await ctx.scheduler.runAfter(5000, internal.messages.delete, { id })

// At specific time
await ctx.scheduler.runAt(timestamp, internal.reports.send, {})
```

### Database Operations

```typescript
// Read
const doc = await ctx.db.get(id)
const docs = await ctx.db.query("table").withIndex("by_x", q => q.eq("x", value)).collect()
const single = await ctx.db.query("table").withIndex("by_x", q => q.eq("x", value)).unique()

// Write
const id = await ctx.db.insert("table", { field: value })
await ctx.db.patch(id, { field: newValue })
await ctx.db.replace(id, { ...fullDocument })
await ctx.db.delete(id)
```

---

## 14. Community Patterns & Wisdom

Distilled from Discord, Stack blog, and Answer Overflow.

### Pattern: Partial Rollback

Use nested mutations for selective rollback on error:

```typescript
export const trySendMessage = mutation({
  args: { body: v.string(), author: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      // This mutation's writes roll back if it throws
      await ctx.runMutation(internal.messages.sendMessage, args)
    } catch (e) {
      // Record failure (this write persists)
      await ctx.db.insert("failures", {
        kind: "MessageFailed",
        body: args.body,
        error: String(e),
      })
    }
    return null
  },
})
```

### Pattern: Thundering Herd Defense

When using rate limiters with `retryAfter`, add jitter to prevent synchronized retries:

```typescript
const { ok, retryAfter } = await rateLimiter.limit(ctx, "signup")

if (!ok) {
  const jitter = Math.random() * 1000 // 0-1000ms random
  const retryTime = retryAfter + jitter
  // Tell client to retry after jittered delay
}
```

### Pattern: Idempotency Keys

For non-idempotent actions, track execution to prevent duplicates:

```typescript
export const processPayment = mutation({
  args: { idempotencyKey: v.string(), amount: v.number() },
  returns: v.union(v.id("payments"), v.null()),
  handler: async (ctx, args) => {
    // Check if already processed
    const existing = await ctx.db
      .query("payments")
      .withIndex("by_idempotency_key", q => q.eq("idempotencyKey", args.idempotencyKey))
      .unique()

    if (existing) return existing._id // Already done

    // Process and record
    const paymentId = await ctx.db.insert("payments", {
      idempotencyKey: args.idempotencyKey,
      amount: args.amount,
      status: "pending",
    })

    await ctx.scheduler.runAfter(0, internal.payments.charge, { paymentId })
    return paymentId
  },
})
```

### Pattern: Soft Deletes with Index

Instead of deleting, mark as deleted and exclude from queries:

```typescript
// Schema
defineTable({
  content: v.string(),
  deletedAt: v.optional(v.number()),
}).index("by_active", ["deletedAt"]) // null sorts first

// Query active only
const activeItems = await ctx.db
  .query("items")
  .withIndex("by_active", q => q.eq("deletedAt", undefined))
  .collect()

// "Delete" = set deletedAt
await ctx.db.patch(itemId, { deletedAt: Date.now() })
```

### Pattern: Optimistic UI with Rollback

Client-side optimistic updates that reconcile on mutation completion:

```typescript
// React client
const sendMessage = useMutation(api.messages.send)
  .withOptimisticUpdate((localStore, args) => {
    const currentMessages = localStore.getQuery(api.messages.list, { channelId: args.channelId })
    if (currentMessages) {
      localStore.setQuery(api.messages.list, { channelId: args.channelId }, [
        ...currentMessages,
        {
          _id: crypto.randomUUID() as Id<"messages">,
          _creationTime: Date.now(),
          content: args.content,
          authorId: args.authorId,
        },
      ])
    }
  })
```

### Anti-Pattern: Multiple runQuery in Actions

```typescript
// ❌ BAD: Data can change between queries
const user = await ctx.runQuery(internal.users.get, { id })
const settings = await ctx.runQuery(internal.settings.get, { userId: id })
// Race condition: user might be deleted between calls

// ✅ GOOD: Single query returns everything needed
const userData = await ctx.runQuery(internal.users.getWithSettings, { id })
```

### Anti-Pattern: Mutation Loops

```typescript
// ❌ BAD: N separate transactions, N OCC conflict opportunities
for (const item of items) {
  await ctx.runMutation(internal.items.process, { item })
}

// ✅ GOOD: Single transaction
await ctx.runMutation(internal.items.processBatch, { items })
```

### Anti-Pattern: Action as Query Replacement

```typescript
// ❌ BAD: Actions aren't reactive, lose real-time updates
export const getData = action({
  handler: async (ctx) => {
    return await ctx.runQuery(internal.data.get, {})
  },
})

// ✅ GOOD: Use query directly (reactive)
export const getData = query({
  handler: async (ctx) => {
    return await ctx.db.query("data").collect()
  },
})
```

---

## References

- [Convex Docs](https://docs.convex.dev)
- [Zen of Convex](https://docs.convex.dev/understanding/zen)
- [Best Practices](https://docs.convex.dev/understanding/best-practices)
- [TypeScript Best Practices](https://docs.convex.dev/understanding/best-practices/typescript)
- [OCC Deep Dive](https://docs.convex.dev/database/advanced/occ)
- [convex-helpers](https://github.com/get-convex/convex-helpers)
- [Convex Workpool](https://github.com/get-convex/workpool)
- [Stack (Technical Blog)](https://stack.convex.dev)
- [Discord Questions (Answer Overflow)](https://discord-questions.convex.dev)
- [Convex Components](https://convex.dev/components)
