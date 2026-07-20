import { LegalPage } from "./LegalPage";
import { legalContent } from "./legalContent";

export default function ImpressumPage() {
  return <LegalPage {...legalContent.impressum} />;
}


