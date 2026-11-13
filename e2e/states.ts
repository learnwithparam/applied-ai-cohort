// biome-ignore-all lint/style/useNamingConvention: the API reads these snake_case field names
// The jobs board with the seed work in it: one job within the label, one that breaks it, and
// one email waiting for a person. The state books them through the API, then reloads the page.
import type { Page } from "@playwright/test";

export type PageState = { name: string; path: string; prepare: (page: Page) => Promise<void> };

const jobs = [
  { grower_id: "G01", field_id: "F01", product_code: "P100", rate_l_per_ha: 1.5 },
  { grower_id: "G01", field_id: "F02", product_code: "P100", rate_l_per_ha: 9 },
];

export const states: PageState[] = [
  {
    name: "jobs board, with the seed",
    path: "/",
    prepare: async (page) => {
      for (const job of jobs) await page.request.post("/api/jobs", { data: job });
      const reason = "The email names two fields.";
      await page.request.post("/api/review", { data: { email_id: "TB-1001", reason } });
      await page.reload();
    },
  },
];
