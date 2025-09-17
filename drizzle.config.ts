import { defineConfig } from "drizzle-kit";

const dbUrl = new URL(process.env.DATABASE_URL as string);

// if (process.env.NODE_ENV === 'production') {
//   dbUrl.searchParams.append('sslmode', 'require');
// } else {
//   dbUrl.searchParams.append('sslmode', 'disable');
// }

export default defineConfig({
  schema: "./db/schema",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl.toString(),
  },
});
