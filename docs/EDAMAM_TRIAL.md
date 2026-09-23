# Trying Edamam search in Nouri

Nouri can optionally show how Edamam understands a food search before presenting the USDA nutrition matches. This is useful for testing natural entries such as:

- `2 cups banana pudding`
- `1 large banana`
- `half a cup of oatmeal`
- `one whole chicken`

The preview is intentionally small. It shows Edamam's top interpretation and, when useful, one close alternative. When someone chooses one, Nouri searches USDA using the cleaner food wording. USDA remains the nutrition source used by Nouri's health review.

This arrangement gives us a fair test of Edamam's natural-language search without copying its nutrition database or changing the medical-rating logic.

## Which plan to start with

Edamam offers a free **Minimum Service** option with limited access for simple development checks. Its current Food Database Basic plan is listed at **$14 per month** and includes a **30-day trial**.

You do not have to use all 30 days. The best time to begin the trial is after the app is already wired up—which it now is—so the trial time is spent testing real searches instead of writing integration code. Edamam says the paid plan begins charging after the trial unless the application is downgraded. Put a reminder on your calendar a few days before the trial ends.

Current plan information: <https://developer.edamam.com/food-database-api>

Downgrade instructions: <https://developer.edamam.com/api/faq>

## Get the two private credentials

1. Create or sign in to an Edamam developer account.
2. Create an application for the **Food Database API**. Do not choose the Recipe Search API for this test.
3. Copy the application's `app_id` and `app_key` from the Edamam dashboard.
4. Open `backend/.env` on your computer and add:

```dotenv
EDAMAM_TRIAL_ENABLED=true
EDAMAM_APP_ID=your_food_database_app_id
EDAMAM_APP_KEY=your_food_database_app_key
```

5. Restart the backend with `npm run dev`.

Do not put these values in `mobile/.env`, `app.json`, screenshots, GitHub issues, or chat messages. The mobile app talks to the Nouri backend, and only the backend talks to Edamam.

To turn the preview off, change `EDAMAM_TRIAL_ENABLED` to `false` and restart the backend. USDA search will continue to work normally.

## What appears in the app

After a search, an **Optional search trial** box appears above the normal USDA results. It shows:

- the food name Edamam recognized;
- an amount and measure when Edamam recognized them;
- one representative household weight when available;
- the required Edamam attribution.

The box is hidden when the trial is disabled. If Edamam is unavailable, Nouri displays a small trial warning but still returns USDA results.

## A useful test list

Try the same phrases in Nouri and keep brief notes about whether the first interpretation is what an everyday person would expect:

| Search | What we hope to see |
| --- | --- |
| `banana` | A plain banana, not a branded snack |
| `2 cups banana pudding` | Banana pudding with two cups understood |
| `chicken` | A general chicken interpretation without dozens of products |
| `chicken breast` | Chicken breast as the first match |
| `tomato` | A general tomato |
| `1 large roma tomato` | Roma tomato with the amount recognized |
| `oatmeal with milk` | A clear composite-food interpretation |

The trial should be judged on search wording and portion recognition—not on whether an Edamam label agrees with Nouri's IBS, IC, kidney, GERD, or diabetes review.

## Why Edamam nutrition is not saved

Edamam's standard plans place strict limits on caching. Nouri therefore does not write trial results or Edamam nutrients to PostgreSQL. Only a live interpretation is shown in response to a person's search.

Before using Edamam nutrients directly in a production health-rating flow, obtain written confirmation that the chosen agreement allows the intended derived ratings, micronutrient use, storage behavior, and commercial release. Until then, USDA remains Nouri's stored nutrition source.

Edamam attribution requirements: <https://developer.edamam.com/attribution>
