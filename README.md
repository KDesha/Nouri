# Nouri - Condition Nutrition App

Nouri is a condition-based nutrition application created to help users make more informed food choices based on their personal health conditions and dietary needs. The purpose of the app is to simplify nutrition information and make it easier to understand how different foods may fit into a user’s lifestyle.

Rather than expecting users to interpret every nutrition label on their own, Nouri is designed to provide clearer guidance through nutrition data, food scoring, and condition-based recommendations. The project combines a backend, database, and mobile interface to support a more user-friendly nutrition experience.

> **Project Status:** This project is still a work in progress. While the core structure and major functionality have been built, future improvements, refinements, and feature additions are still planned.

## Overview

Nouri was developed as a senior project to address the challenge many people face when trying to determine whether a food is a good choice for their specific dietary concerns. Nutrition labels can be confusing, ingredient lists are not always easy to interpret, and different health conditions often require users to pay attention to different nutritional factors.

This app aims to make that process easier by organizing nutrition-related data into a more understandable and accessible format.

## Features

- Condition-based food guidance
- Nutrition data lookup
- Food scoring and rule-based evaluation
- Backend support for food and nutrition processing
- Mobile app screens for user interaction
- Database schema and seed files
- Automated backend test coverage for core logic

## Project Structure

condition-nutrition-app/
- backend/
- database/
- mobile/

### backend/

The backend contains the main application logic, authentication-related files, food data handling, scoring logic, nutrition processing, database connections, and automated tests.

Example backend-related files include:

- src/database.ts
- src/fdcClient.ts
- src/foodsRepo.ts
- src/nutritionData.ts
- src/rules.ts
- src/scoreDb.ts
- src/PHLocal.ts

The backend also includes test files such as:

- auth.api.test.ts
- phLocal.test.ts
- scoreDb.overrides.test.ts
- scoreDb.scoring.test.ts
- scoreDb.unit.test.ts

### database/

The database folder contains SQL files used to build and populate the database.

Files include:

- nouri_schema.sql
- nouri_seed.sql

### mobile/

The mobile folder contains the user-facing mobile interface and screens for the app.

Files currently include:

- AuthScreen.tsx
- DemoScreen.tsx

## Tech Stack

This project includes a combination of the following technologies:

- TypeScript / JavaScript
- Mobile application components
- Backend API and business logic
- SQL database structure and seed files
- Automated testing tools

## Purpose of the Project

The purpose of Nouri is to help users make more confident and informed food choices based on dietary needs and selected health conditions. The app is intended to reduce confusion around nutrition labels and create a more supportive experience for users trying to evaluate what foods may or may not be a good fit for them.

This project was also developed as part of a senior project, combining planning, design, implementation, testing, and documentation into a complete application concept.

## Current Status

Nouri is currently in development and should be considered a work in progress.

At this stage, the project includes its main structure, supporting files, database setup, mobile screens, and backend logic. Core functionality has been developed and tested, but the project is still open to further improvement.

Planned future improvements may include:

- Expanded condition support
- Improved mobile interface and user experience
- More detailed food recommendations
- Expanded nutrition database integration
- Additional testing and validation
- Performance improvements
- Better personalization options for users

## Setup Instructions

Setup may vary depending on your environment and which portion of the project you want to run, but the general process is:

1. Clone the repository
2. Install dependencies
3. Configure environment variables
4. Set up the database using the schema and seed files
5. Start the backend
6. Run the mobile application

### Example general steps

git clone <your-repository-url>
cd condition-nutrition-app

Then install project dependencies in the appropriate folders and run the necessary services based on your local setup.

## Database

The database portion of the project includes:

- A schema file for creating the project database structure
- A seed file for inserting starting data

These files are located in the database/ folder and are intended to support the backend logic used for food and nutrition-related processing.

## Testing

The backend includes multiple test files to help validate functionality related to:

- Authentication behavior
- Local pH-related processing
- Food scoring logic
- Override handling
- General database scoring behavior

Testing is included to support reliability and verify that the project’s core logic behaves as expected.

## Notes

This repository reflects the current development version of Nouri. Because the project is still evolving, files, features, and functionality may continue to change over time.

If you are viewing this project on GitHub, please note that this version represents the current state of development and not necessarily the final version of the application.

## Authors

Created as part of a senior project by Kayla DeShasier
