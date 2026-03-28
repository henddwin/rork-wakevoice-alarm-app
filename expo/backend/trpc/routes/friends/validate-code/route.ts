import { publicProcedure } from "../../../create-context";
import { z } from "zod";

export const validateCodeProcedure = publicProcedure
  .input(
    z.object({
      code: z.string().length(10),
    })
  )
  .query(async ({ input }) => {
    console.log("Validating code:", input.code);
    
    return {
      valid: true,
      code: input.code,
    };
  });

export default validateCodeProcedure;
