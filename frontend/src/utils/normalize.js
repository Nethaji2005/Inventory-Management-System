export function normalizeSizeString(input = "") {
  if (input == null) return "";
  // replace multiple spaces, standardize x separators
  let s = input.replace(/[×X*]/g, "x"); // accept × or X or *
  s = s.replace(/\s*[x]\s*/gi, " x ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}
