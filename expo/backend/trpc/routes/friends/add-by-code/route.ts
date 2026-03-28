import { publicProcedure } from "../../../create-context";
import { z } from "zod";

export const addByCodeProcedure = publicProcedure
  .input(
    z.object({
      code: z.string().length(10),
      myCode: z.string().length(10),
    })
  )
  .mutation(async ({ input }) => {
    console.log("Adding friend by code:", input);
    
    return {
      success: true,
      friendCode: input.code,
    };
  });

export default addByCodeProcedure;
