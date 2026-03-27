import { publicProcedure, router } from "./_core/trpc";
import { fetchTreasuryData } from "./treasury";

export const appRouter = router({
  treasury: router({
    getData: publicProcedure.query(async () => {
      return await fetchTreasuryData();
    }),
  }),
});

export type AppRouter = typeof appRouter;
