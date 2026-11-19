import { calculateFieldCompletion, isFilled, type FieldCompletion } from "@/lib/profile-completion";
import type { CustomerProfileResponse } from "../types";

/** Required customer details. WhatsApp number and photo are optional and not counted. */
export function calculateCustomerCompletion(profile: CustomerProfileResponse): FieldCompletion {
  return calculateFieldCompletion([
    { key: "name", label: "Full name", filled: isFilled(profile.name) },
    { key: "phone", label: "Mobile number", filled: isFilled(profile.phone) },
    { key: "email", label: "Email address", filled: isFilled(profile.email) },
    { key: "dob", label: "Date of birth", filled: isFilled(profile.dob) },
    { key: "gender", label: "Gender", filled: isFilled(profile.gender) },
  ]);
}
