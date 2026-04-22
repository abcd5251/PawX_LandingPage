import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import AlertBotSection from "@/components/AlertBotSection";
import WebSocketSection from "@/components/WebSocketSection";
import ApiSection from "@/components/ApiSection";
import PartnersSection from "@/components/PartnersSection";
import CtaSection from "@/components/CtaSection";
import Footer from "@/components/Footer";
import {
  AUTH_REDIRECT_STORAGE_KEY,
  buildPathWithReferralCode,
  fetchXSession,
  persistReferralCodeFromUrl,
  readFrontendXSessionFromHash,
  storeFrontendXSession,
} from "@/lib/creditHubAuth";

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    persistReferralCodeFromUrl(location.search);
  }, [location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    let cancelled = false;

    const captureInboundSession = async () => {
      const fragmentSession = readFrontendXSessionFromHash(location.hash);

      if (fragmentSession) {
        console.log("[x-session-landing] fragment detected", fragmentSession);
        storeFrontendXSession(fragmentSession.sessionUser);

        if (!cancelled) {
          navigate(buildPathWithReferralCode("/credit-hub", location.search), { replace: true });
        }
        return;
      }

      const ott = params.get("ott");

      if (!ott) {
        return;
      }

      console.log("[x-session-landing] ott detected", {
        redirectOrigin: fragmentSession?.redirectOrigin || "",
        sessionPayloadLength: 0,
        search: location.search,
      });

      const sessionUser = await fetchXSession(ott);

      if (!sessionUser || cancelled) {
        return;
      }

      const cleanParams = new URLSearchParams(location.search);
      cleanParams.delete("ott");
      cleanParams.delete("auth");
      const cleanSearch = cleanParams.toString();
      const nextPath = cleanSearch ? `/credit-hub?${cleanSearch}` : "/credit-hub";

      navigate(buildPathWithReferralCode(nextPath, cleanSearch ? `?${cleanSearch}` : ""), { replace: true });
    };

    void captureInboundSession();

    return () => {
      cancelled = true;
    };
  }, [location.hash, location.search, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const authStatus = params.get("auth");
    const shouldCheckSession =
      window.sessionStorage.getItem(AUTH_REDIRECT_STORAGE_KEY) === "1" ||
      authStatus === "success" ||
      params.has("code") ||
      params.has("state") ||
      params.has("oauth_token") ||
      params.has("oauth_verifier");

    if (!shouldCheckSession) {
      return;
    }

    if (location.hash.includes("pawx_x_session") || params.has("ott")) {
      return;
    }

    const redirectSignedInUser = async () => {
      const ott = params.get("ott");

      // If we have an OTT, navigate to CreditHub and let it consume the OTT.
      // This avoids consuming the OTT here and then failing the cookie-based
      // session check in CreditHub (which Safari ITP blocks for cross-origin cookies).
      if (ott && authStatus === "success") {
        navigate(buildPathWithReferralCode("/credit-hub", location.search), { replace: true });
        return;
      }

      const sessionUser = await fetchXSession();

      if (sessionUser) {
        navigate(buildPathWithReferralCode("/credit-hub", location.search), { replace: true });
        return;
      }

      window.sessionStorage.removeItem(AUTH_REDIRECT_STORAGE_KEY);
    };

    void redirectSignedInUser();
  }, [location.hash, location.search, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <ApiSection />
      <WebSocketSection />
      <AlertBotSection />
      <FeaturesSection />
      <PartnersSection />
      <CtaSection />
      <Footer />
    </div>
  );
};

export default Index;
