export const isTengaHarvestPath = (pathname = "") =>
  pathname === "/tengaharvest" ||
  pathname.startsWith("/tengaharvest/") ||
  pathname === "/admin/tengaharvest";
