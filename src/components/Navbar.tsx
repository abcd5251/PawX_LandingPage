import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.jpg";
import { Sparkles } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { buildPathWithReferralCode } from "@/lib/creditHubAuth";

const Navbar = () => {
  const location = useLocation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex justify-center backdrop-blur-sm">
      <div className="glass-card px-6 py-3 flex items-center gap-8 rounded-full">
        {/* 简洁可爱的 Logo */}
        <a href="#top" className="flex items-center gap-2 cursor-pointer">
          <img
            src={logo}
            alt="PawX AI"
            className="w-8 h-8 rounded-lg object-cover"
          />
          <span className="text-lg font-bold text-foreground">PawX AI</span>
        </a>

        {/* 简洁导航链接 */}
        <div className="hidden md:flex items-center gap-2">
          <a href="#api" className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-primary/5 transition-all">
            API
          </a>
          <a href="#websocket" className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-primary/5 transition-all">
            Websocket
          </a>
          <a href="#alert-bot" className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-primary/5 transition-all">
            Bot
          </a>
          <a href="#features" className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-primary/5 transition-all">
            Social
          </a>
          <a href="#pricing" className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-primary/5 transition-all">
            Pricing
          </a>
          <a href="#partners" className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-primary/5 transition-all">
            Partners
          </a>
        </div>

        {/* 简洁按钮 */}
        <Button size="sm" className="rounded-full group" asChild>
          <Link to={buildPathWithReferralCode("/credit-hub", location.search)}>
            <Sparkles className="w-3.5 h-3.5 mr-1.5 group-hover:rotate-12 transition-transform" />
            Start
          </Link>
        </Button>
      </div>
    </nav>
  );
};

export default Navbar;
