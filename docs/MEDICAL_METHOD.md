# Nouri food-guidance methodology

Nouri is an educational screening tool, not a medical device or an individualized meal prescription. A single food cannot be labeled universally “good” or “bad” for most chronic conditions. The app therefore reports the selected serving, the reason for each flag, and a confidence level. Missing data stays missing.

## Shared serving logic

USDA FoodData Central nutrient values are stored per 100 g. Nouri uses USDA household gram weights to estimate the portion selected by the user:

`estimated nutrient in serving = nutrient per 100 g × serving grams ÷ 100`

The FDA’s general label guide is used where a per-serving comparison is appropriate: 5% Daily Value or less is low and 20% or more is high. These are label-screening points, not personal treatment targets.

## Conditions

### Chronic kidney disease

- Sodium is screened per serving.
- Kidney stage is retained only as context. Stage alone does not determine potassium, phosphorus, protein, or fluid limits.
- Potassium and phosphorus affect the rating only when the user says their care team has told them to limit that nutrient. For that setting, 200 mg or more potassium per serving is flagged as a higher-potassium food. Phosphorus is flagged at the FDA's general high-Daily-Value point, but the app still directs the user to their personal target.
- Phosphorus data may miss phosphate additives, natural and added phosphorus are absorbed differently, and preparation methods can change potassium and sodium.

Sources: [NIDDK—Healthy Eating for Adults with Chronic Kidney Disease](https://www.niddk.nih.gov/health-information/kidney-disease/chronic-kidney-disease-ckd/healthy-eating-adults-chronic-kidney-disease), [National Kidney Foundation—Potassium in Your CKD Diet](https://www.kidney.org/kidney-topics/potassium-your-ckd-diet)

### Interstitial cystitis / bladder pain syndrome

The app checks the food name for the symptom-trigger categories listed by NIDDK: citrus, coffee/tea/soda/caffeine, alcohol, tomato, hot or spicy foods, artificial sweeteners, chocolate, and MSG. A match means “review,” not “everyone must avoid.” A non-match stays uncertain because personal food diaries are more reliable than a food-pH or “alkaline” list.

Source: [NIDDK—Eating, Diet, & Nutrition for Interstitial Cystitis](https://www.niddk.nih.gov/health-information/urologic-diseases/interstitial-cystitis-bladder-pain-syndrome/eating-diet-nutrition)

### IBS

Nouri performs a conservative food-name screen using common FODMAP examples, keeps portion- or ripeness-sensitive foods uncertain, separates caffeine/alcohol/spice/fried-food triggers from FODMAP groups, and supports the short restriction, reintroduction, and personalization phases. It does not claim to reproduce laboratory-tested Monash serving data.

Sources: [NIDDK—Eating, Diet, & Nutrition for IBS](https://www.niddk.nih.gov/health-information/digestive-diseases/irritable-bowel-syndrome/eating-diet-nutrition), [Monash University—IBS diets](https://www.monashfodmap.com/ibs-central/diets/)

### Crohn’s disease

The app does not declare foods universally safe or unsafe from fiber alone. It shows serving nutrition and explains that symptoms, strictures, surgery, medicines, and nutrition status can change an individual plan. Personal reactions may add context.

Source: [NIDDK—Eating, Diet, & Nutrition for Crohn’s Disease](https://www.niddk.nih.gov/health-information/digestive-diseases/crohns-disease/eating-diet-nutrition)

### GERD / reflux

The app checks common symptom-trigger categories listed by NIDDK: citrus/tomato, alcohol, chocolate, coffee/caffeine, high-fat servings, mint, and spicy foods. Trigger response is individual, and meal timing and total meal size are not available from a food record.

Source: [NIDDK—Eating, Diet, & Nutrition for GER & GERD](https://www.niddk.nih.gov/health-information/digestive-diseases/acid-reflux-ger-gerd-adults/eating-diet-nutrition)

### Diabetes

The app reports total carbohydrate per selected serving, highlights at least 3 g fiber as a higher-fiber choice, flags 10 g or more added sugar as at least 20% Daily Value, and identifies likely sugar-sweetened beverages. It does not ban whole fruit, call a food safe from carbohydrate alone, or prescribe a carbohydrate target because medication, insulin, activity, and individual goals change that target.

Source: [American Diabetes Association—Standards of Care in Diabetes 2026, Section 5](https://diabetesjournals.org/care/article/49/Supplement_1/S89/163932/5-Facilitating-Positive-Health-Behaviors-and-Well)

### High blood pressure

Sodium is screened per selected serving. At or below 115 mg is no more than 5% of the FDA Daily Value; 460 mg or more is at least 20% and is flagged as high. Values between those two points stay uncertain instead of using an unsupported cutoff. The result is one part of a daily sodium pattern.

Sources: [FDA—Daily Value on Nutrition Facts Labels](https://www.fda.gov/food/nutrition-facts-label/daily-value-nutrition-and-supplement-facts-labels), [American Heart Association—Daily sodium](https://www.heart.org/en/healthy-living/healthy-eating/eat-smart/sodium/how-much-sodium-should-i-eat-per-day)

### Heart health

The screen uses saturated fat, sodium, and fiber per serving. Saturated fat of 4 g or more is at least 20% of the FDA Daily Value and is flagged for review. The result cannot replace assessment of the person’s overall eating pattern or cardiovascular risk.

Source: [American Heart Association—Saturated Fats](https://www.heart.org/en/healthy-living/healthy-eating/eat-smart/fats/saturated-fats)

## Conditions not inferred from current data

Nouri does not currently rate food allergy safety, celiac safety, medication interactions, gout/purines, or microbiological safety. Those require reliable ingredient, cross-contact, laboratory, preparation, or medication data that a general USDA nutrient record does not provide. Returning an unsupported confident rating would be less safe than leaving these out.
