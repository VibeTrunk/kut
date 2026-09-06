import { permanentRedirect } from "next/navigation";

export default function TradeCardsRedirect() {
  permanentRedirect("/club/collection/wanted#available");
}
