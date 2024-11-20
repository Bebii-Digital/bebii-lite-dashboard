import { configDotenv } from "dotenv";

configDotenv();

export const CONFIG = {
    port: process.env.PORT,
    db: {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'root',
        database: process.env.DB_NAME || 'bebii_digital'
    }
};