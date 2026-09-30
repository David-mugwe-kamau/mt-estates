export function passwordIssue(password: string, email = "", name = ""): string | null {
  if (!password || password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  const local = email.split("@")[0]?.toLowerCase() || "";
  const lower = password.toLowerCase();
  if (local && local.length >= 3 && lower.includes(local)) {
    return "Password cannot contain your email name.";
  }
  const first = name.trim().split(/\s+/)[0]?.toLowerCase() || "";
  if (first.length >= 3 && lower === first) {
    return "Password cannot be your first name.";
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must include letters and a number.";
  }
  return null;
}
