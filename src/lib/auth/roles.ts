export function isAdminRole(role: string | null | undefined): role is "admin" | "superadmin" {
  return role === "admin" || role === "superadmin";
}
