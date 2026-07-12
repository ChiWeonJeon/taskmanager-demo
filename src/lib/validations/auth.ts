import { z } from "zod";

interface AuthValidationMessages {
  emailInvalid: string;
  passwordRequired: string;
  nameTooShort: string;
  passwordTooShort: string;
  passwordMismatch: string;
}

export function createLoginSchema(messages: AuthValidationMessages) {
  return z.object({
    email: z.string().email(messages.emailInvalid),
    password: z.string().min(1, messages.passwordRequired),
  });
}

export function createRegisterSchema(messages: AuthValidationMessages) {
  return z.object({
    name: z.string().min(2, messages.nameTooShort),
    email: z.string().email(messages.emailInvalid),
    password: z.string().min(8, messages.passwordTooShort),
    confirmPassword: z.string(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: messages.passwordMismatch,
    path: ["confirmPassword"],
  });
}

// Callers must construct the schema via createLoginSchema / createRegisterSchema
// with locale-aware messages. Type helpers below derive the shape without
// embedding any user-facing strings.
const typeOnlyMessages: AuthValidationMessages = {
  emailInvalid: "",
  passwordRequired: "",
  nameTooShort: "",
  passwordTooShort: "",
  passwordMismatch: "",
};

export type LoginInput = z.infer<ReturnType<typeof createLoginSchema>>;
export type RegisterInput = z.infer<ReturnType<typeof createRegisterSchema>>;

// Unused at runtime — retained only to keep the type inference above valid
// in older tooling that requires a concrete instance to resolve generics.
void createLoginSchema(typeOnlyMessages);
void createRegisterSchema(typeOnlyMessages);
