# Edamam search in Nouri

Nouri uses the paid Edamam Food Database API to help interpret natural food entries such as:

- `2 cups banana pudding`
- `1 large banana`
- `half a cup of oatmeal`
- `one whole chicken`

The search assistance stays intentionally focused. It shows Edamam's top interpretation and, when useful, one close alternative. Choosing an interpretation searches USDA using the clearer wording. USDA remains the nutrition source used by Nouri's health review.

## Configure the paid API

1. Sign in to the Edamam developer dashboard.
2. Create an application for the **Food Database API**. Credentials for other Edamam APIs are not interchangeable.
3. Copy the application's `app_id` and `app_key`.
4. Add them to `backend/.env`:

```dotenv
EDAMAM_ENABLED=true
EDAMAM_APP_ID=your_food_database_app_id
EDAMAM_APP_KEY=your_food_database_app_key
```

5. Restart the backend with `npm run dev`.

The previous `EDAMAM_TRIAL_ENABLED=true` setting is still recognized for existing local installations, but new deployments should use `EDAMAM_ENABLED=true`.

Never put the credentials in `mobile/.env`, `app.json`, screenshots, GitHub issues, or chat messages. The mobile app talks to the Nouri backend, and only the backend talks to Edamam.

To turn off Edamam search assistance, set `EDAMAM_ENABLED=false` and restart the backend. USDA search continues to work normally.

## What appears in the app

After a search, a **Smart search match** section can appear above the USDA results. It shows:

- the food name Edamam recognized;
- an amount and measure when Edamam recognized them;
- one representative household weight when available;
- the required Edamam attribution.

If Edamam is unavailable, Nouri displays a small warning but still returns USDA results.

## Useful search checks

| Search | Expected interpretation |
| --- | --- |
| `banana` | A plain banana, not a branded snack |
| `2 cups banana pudding` | Banana pudding with two cups understood |
| `chicken` | A general chicken interpretation without dozens of products |
| `chicken breast` | Chicken breast as the first match |
| `tomato` | A general tomato |
| `1 large roma tomato` | Roma tomato with the amount recognized |
| `oatmeal with milk` | A clear composite-food interpretation |

Edamam assists with wording and portion recognition. It does not determine whether a food is appropriate for IBS, IC, kidney disease, GERD, diabetes, or another health setting.

## Data handling

Nouri does not write Edamam results or nutrients to PostgreSQL. Only a live interpretation is shown in response to a person's search.

Before using Edamam nutrients directly in a production health-rating flow, confirm that the paid agreement permits the intended derived ratings, micronutrient use, storage behavior, and commercial release. Until then, USDA remains Nouri's stored nutrition source.

Edamam attribution requirements: <https://developer.edamam.com/attribution>
