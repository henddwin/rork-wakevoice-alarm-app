import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import addByCodeRoute from "./routes/friends/add-by-code/route";
import validateCodeRoute from "./routes/friends/validate-code/route";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  friends: createTRPCRouter({
    addByCode: addByCodeRoute,
    validateCode: validateCodeRoute,
  }),
});

export type AppRouter = typeof appRouter;
