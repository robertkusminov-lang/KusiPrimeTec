const LEGAL_PATHS = new Set([
  "/impressum",
  "/datenschutz",
  "/agb",
  "/widerruf",
  "/haftung-koordination",
]);

const OBJECT_CARE_REQUEST_PATH = "/objektbetreuung-anfrage?anliegen=objektbetreuung";
const OBJECT_CHECK_REQUEST_PATH = "/objektbetreuung-anfrage?anliegen=objektcheck";

export interface MobileStickyCta {
  href: string;
  label: string;
}

export function normalizePublicPath(pathname: string): string {
  const clean = String(pathname || "").trim();
  if (!clean) return "/";
  return clean.split(/[?#]/)[0]?.replace(/\/+$/, "") || "/";
}

export function shouldHideMobileStickyCta(pathname: string): boolean {
  const path = normalizePublicPath(pathname);
  return (
    path === "/buchen" ||
    path === "/objektbetreuung-anfrage" ||
    path.startsWith("/konto") ||
    path.startsWith("/admin") ||
    LEGAL_PATHS.has(path)
  );
}

export function getMobileStickyCta(pathname: string): MobileStickyCta | null {
  const path = normalizePublicPath(pathname);

  if (shouldHideMobileStickyCta(path)) {
    return null;
  }

  switch (path) {
    case "/objektbetreuung":
      return { href: OBJECT_CARE_REQUEST_PATH, label: "Betreuung anfragen" };
    case "/objektcheck":
      return { href: OBJECT_CHECK_REQUEST_PATH, label: "ObjektCheck anfragen" };
    case "/leistungen":
      return { href: "/objektbetreuung", label: "ObjektBetreuung prüfen" };
    case "/einzelauftrag":
      return { href: "/einzelauftrag", label: "Einzelauftrag melden" };
    default:
      return { href: OBJECT_CARE_REQUEST_PATH, label: "ObjektBetreuung anfragen" };
  }
}
