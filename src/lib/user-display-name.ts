import { z } from "zod";

/** Max length for first/last name fields (API + forms). */
export const USER_NAME_PART_MAX_LENGTH = 80;

function namePartSchema(label: "first name" | "last name") {
  const title = label.charAt(0).toUpperCase() + label.slice(1);
  return z
    .string()
    .trim()
    .min(1, `Enter your ${label}.`)
    .max(
      USER_NAME_PART_MAX_LENGTH,
      `${title} must be at most ${USER_NAME_PART_MAX_LENGTH} characters.`,
    );
}

export const firstNameFieldSchema = namePartSchema("first name");
export const lastNameFieldSchema = namePartSchema("last name");

/** Build denormalized Auth.js `name` from first + last. */
export function fullNameFromParts(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.replace(/\s+/g, " ").trim();
}

/** Display label: synced full `name` when present, otherwise email. */
export function userDisplayName(user: {
  name?: string | null;
  email: string;
}): string {
  const name = user.name?.trim();
  return name && name.length > 0 ? name : user.email;
}
