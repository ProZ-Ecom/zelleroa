import { z } from "zod";
import { emailField } from "@/lib/validations/email";

export const subscribeNewsletterSchema = z
  .object({
    email: emailField,
  })
  .strict();

export type SubscribeNewsletterInput = z.infer<typeof subscribeNewsletterSchema>;
