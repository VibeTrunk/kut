import { permanentRedirect } from "next/navigation";

/**
 * The /club hub retired in ADR-053. Its only job was linking to Collection and
 * Packs — both already primary tabs — plus Club Value, which now sits on the
 * Collection header. Redirected rather than deleted, following /sessions.
 */
export default function ClubRedirect() {
  permanentRedirect("/club/collection");
}
