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
import { AUTH_REDIRECT_STORAGE_KEY, fetchXSession, persistReferralCodeFromUrl } from "@/lib/creditHubAuth";

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    persistReferralCodeFromUrl(location.search);
  }, [location.search]);

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

    const redirectSignedInUser = async () => {
      const sessionUser = await fetchXSession();

      if (sessionUser) {
        navigate("/credit-hub", { replace: true });
        return;
      }

      window.sessionStorage.removeItem(AUTH_REDIRECT_STORAGE_KEY);
    };

    void redirectSignedInUser();
  }, [location.search, navigate]);

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
