import dotenv from "dotenv";
import path from "path";

// Always load backend/.env no matter where jest is launched from
dotenv.config({ path: path.resolve(__dirname, ".env") });