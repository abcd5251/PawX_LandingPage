import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import PawIcon from "@/components/PawIcon";

interface LoginScreenProps {
  onLogin: () => void;
}

const pawDecorations = [
  { className: "top-[8%] left-[2%]", size: 56, rotate: -12, delay: 0 },
  { className: "top-[11%] right-[2%]", size: 52, rotate: 15, delay: 0.5 },
  { className: "top-[36%] left-[6%]", size: 64, rotate: -18, delay: 0.9 },
  { className: "top-[40%] right-[5%]", size: 62, rotate: 18, delay: 1.3 },
  { className: "bottom-[10%] left-[3%]", size: 60, rotate: -8, delay: 1.8 },
  { className: "bottom-[14%] right-[3%]", size: 66, rotate: 10, delay: 2.2 },
];

const LoginScreen = ({ onLogin }: LoginScreenProps) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {pawDecorations.map((paw) => (
        <motion.div
          key={paw.className}
          className={`absolute opacity-20 pointer-events-none ${paw.className}`}
          style={{ rotate: paw.rotate }}
          animate={{ x: [0, 14, -10, 0], y: [0, -12, 9, 0], opacity: [0.14, 0.24, 0.18, 0.14] }}
          transition={{
            duration: 18,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
            delay: paw.delay,
          }}
        >
          <PawIcon size={paw.size} />
        </motion.div>
      ))}

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex flex-col items-center gap-8 z-10"
      >
        <div className="flex items-center gap-3">
          <PawIcon size={56} />
          <span className="text-5xl md:text-6xl font-extrabold tracking-tight text-foreground">
            Paw<span className="text-primary">X</span> AI
          </span>
        </div>

        <div className="text-center space-y-3">
          <h1 className="text-6xl md:text-7xl font-extrabold leading-tight">
            API <span className="bg-gradient-to-r from-orange-500 to-amber-400 bg-clip-text text-transparent">Credits</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-md">
            Sign in with X to access your API credits, track usage, and earn more through referrals ✨
          </p>
        </div>

        <div className="flex gap-3">
          {["🐾 Real-Time", "⚡ Fast", "🧠 Smart"].map((tag) => (
            <span
              key={tag}
              className="px-4 py-1.5 rounded-full border border-primary/20 text-sm font-medium text-primary bg-card"
            >
              {tag}
            </span>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <Button size="lg" onClick={onLogin} className="gap-3 text-base px-10 rounded-xl bg-foreground text-card">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-[2px] bg-card text-foreground text-xs font-bold">
              X
            </span>
            Sign in with X
          </Button>
        </motion.div>

        <p className="text-muted-foreground text-xs">
          Connect your X account to get started with 2,500 free credits
        </p>
      </motion.div>
    </div>
  );
};

export default LoginScreen;
