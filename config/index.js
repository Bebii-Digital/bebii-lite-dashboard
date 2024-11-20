import { configDotenv } from "dotenv";

configDotenv();

export const CONFIG = {
    port: process.env.APP_PORT,
};