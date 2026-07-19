# Plan: Merge Complaints into Feedback (+ rating sort filter)

Goal: one concept — "Feedback". A complaint is just feedback that has a **Category**.
Rating becomes required on every submission so everything can be sorted by rating.
No data migration needed (Complaints only holds dev/test rows; seed has none).

Execute the steps in order. Do not refactor anything not listed here.

---

## Step 1 — Database (database/seed.sql)

1. In the `CREATE TABLE dbo.Feedback` block, add one column after `Rating`:
   ```sql
   Category   NVARCHAR(50)   NULL,   -- NULL = general feedback; set = complaint (e.g. 'Hygiene')
   ```
2. Delete the entire `CREATE TABLE dbo.Complaints` block AND the
   `IF OBJECT_ID('dbo.Complaints', 'U') IS NOT NULL DROP TABLE dbo.Complaints;` line at the top.
3. In the Feedback seed INSERT, change the column list to
   `(StallId, UserId, Rating, Category, Comment, CreatedAt)` and add a Category value
   to each row: use `NULL` for the existing positive rows, and change the two
   lowest-rated rows (the two `3`-ratings) to `'Service'` and `'Food Quality'`
   so the dashboard has complaint examples.

Apply to the live DB without wiping data — run these two statements once
(e.g. via a small script or SSMS):
```sql
ALTER TABLE dbo.Feedback ADD Category NVARCHAR(50) NULL;
DROP TABLE dbo.Complaints;
```

## Step 2 — Validation (middlewares/validateMiddleware.js)

1. In `feedbackSchema`, add:
   ```js
   category: Joi.string().valid("Hygiene", "Service", "Food Quality", "Wrong Order", "Other").allow(null, ""),
   ```
   Keep `rating` required (1–5) and `comment` required.
2. Delete `complaintSchema` and remove it from `module.exports`.

## Step 3 — Model (models/feedbackModel.js)

1. `createFeedback`: accept and insert `category` (pass `category || null`).
2. `getFeedbackById`: also SELECT `Category`.
3. Delete the file `models/complaintModel.js`.

## Step 4 — Controller + routes

1. `controllers/feedbackController.js`: read `category` from `req.body`, pass it to
   `createFeedback`. Nothing else changes.
2. Delete `controllers/complaintController.js`.
3. In `app.js`: delete the two "Complaint routes" lines (the `require` and the
   `app.post("/api/complaints", ...)`) and remove `complaintSchema` from the
   middleware import list.

## Step 5 — Satisfaction data (models/analyticsModel.js)

Replace `getSatisfactionData` with ONE query (delete the complaints query):
```js
async function getSatisfactionData(stallId) {
  const result = await sql.query`
    SELECT f.Rating, f.Category, f.Comment, f.CreatedAt, u.Username
    FROM Feedback f
    JOIN Users u ON f.UserId = u.UserId
    WHERE f.StallId = ${stallId}
    ORDER BY f.CreatedAt DESC
  `;
  return { feedback: result.recordset };
}
```

## Step 6 — Dashboard UI (public/stall-analytics.html + public/js/stall-analytics.js)

1. HTML: delete the separate Complaints table/section. Keep one "Customer Feedback"
   table with columns: Date | Customer | Rating | Category | Comment.
   Above it add:
   ```html
   <select id="feedbackSortFilter" class="form-select" style="max-width:200px">
     <option value="newest" selected>Newest first</option>
     <option value="lowest">Lowest rating first</option>
     <option value="highest">Highest rating first</option>
   </select>
   ```
2. JS: in `renderSatisfactionSection(data)`:
   - Remove all complaint-table code (`complaintTableBody`, `noComplaints`).
   - Store `data.feedback` in a module-level `let satisfactionRows = []`.
   - Render rows sorted according to `#feedbackSortFilter`:
     `newest` → by `CreatedAt` desc (API default order already), `lowest` → `Rating` asc,
     `highest` → `Rating` desc. Sort a **copy** (`[...satisfactionRows].sort(...)`).
   - Category cell: `f.Category ? '<span class="badge badge-closed">' + escapeHtml(f.Category) + '</span>' : '—'`.
   - Add a `change` listener on `#feedbackSortFilter` that re-renders from
     `satisfactionRows` (no API call).

## Step 7 — Submission form (public/feedback.html + public/js/feedback.js + public/js/i18n.js)

1. Remove the `requestType` (feedback/complaint) selector and `updateFormMode()`.
2. Single form: stall select, rating select (required), NEW optional category select
   (first option: "General feedback" with value "", then Hygiene / Service /
   Food Quality / Wrong Order / Other), comment textarea (required).
3. `handleFeedbackSubmit`: always `POST /api/feedback` with
   `{ stallId, rating, comment, category: category || undefined }`.
4. Remove complaint-only i18n keys; add a key for the category label if needed.

## Step 8 — Stall reviews sort (models/stallModel.js, public page that shows reviews)

`getReviewsByStallId(stallId, sort)` currently supports `newest` / `highest`.
1. Add `lowest` → `ORDER BY Rating ASC, CreatedAt DESC`.
2. In `stallController.getStallReviews`, allow it:
   `const sort = ["highest", "lowest"].includes(req.query.sort) ? req.query.sort : "newest";`
3. Wherever the reviews list is rendered on the customer-facing page, add the same
   three-option sort dropdown that re-fetches with `?sort=`.
4. Reviews responses should also include `Category` so complaint-type feedback is
   visible there (add the column to the SELECT in `getReviewsByStallId`).

## Verification checklist (run all)

1. `node database/runSeed.js` completes with no errors (drop-and-recreate world), OR
   the two live-DB statements from Step 1 ran once.
2. POST `/api/feedback` with `{stallId, rating: 2, comment, category: "Hygiene"}` → 201.
3. POST `/api/feedback` without category → 201 (general feedback).
4. POST `/api/feedback` with `category: "abc"` → 400 (Joi enum).
5. POST `/api/complaints` → 404 (route gone).
6. GET `/api/analytics/satisfaction` as a stall owner → single `feedback` array with
   `Category` present; dashboard shows one table; sort dropdown re-orders rows
   without a network call (check DevTools network tab).
7. GET `/api/stalls/1/reviews?sort=lowest` → reviews ordered by rating ascending.
8. Feedback page: submit both a general feedback and a categorised complaint as
   `jane_doe` / `password`; both appear on the owner dashboard (`ahmad88` / `password`).

## Jira (do NOT do this in code — for the human/Claude after verification)

- SCRUM-23 (complaints): comment that it merged into the feedback feature, close it.
- SCRUM-15 (feedback) + SCRUM-25 (satisfaction dashboard): comment describing the
  merged design and the new rating sort.
