import { useState } from "react";
import { motion, type Variants } from "framer-motion";

interface AnimatedPawProps {
  label: string;
  className?: string;
  flip?: boolean;
  rotate?: number;
}

const AnimatedPaw = ({ label, className = "", flip = false, rotate = 0 }: AnimatedPawProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isActive, setIsActive] = useState(false);

  // Animation variants for vertical floating
  const floatingVariants: Variants = {
    initial: {
      y: [0, -20, 0],
      transition: {
        duration: 2.5,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
    active: {
      y: [0, -10, 0],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
  };

  return (
    <div className={`absolute ${className}`}>
      <motion.div
        className="relative cursor-pointer"
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        onClick={() => setIsActive(!isActive)}
        animate={isActive ? "active" : "initial"}
        variants={floatingVariants}
      >
        {/* Paw Image Container */}
        <div
          className={`relative w-20 h-20 sm:w-28 sm:h-28 lg:w-32 lg:h-32 xl:w-40 xl:h-40 ${flip ? "scale-x-[-1]" : ""}`}
          style={{ transform: `rotate(${rotate}deg) ${flip ? "scaleX(-1)" : ""}` }}
        >
          {/* Base grey paw (always visible) */}
          <img
            src="/paw.png"
            alt="paw"
            className="absolute inset-0 w-full h-full object-contain opacity-50 grayscale"
          />

          {/* White blinking paw (initial state) */}
          {!isActive && (
            <motion.img
              src="/paw.png"
              alt="paw"
              className="absolute inset-0 w-full h-full object-contain"
              animate={{
                opacity: [0.7, 1, 0.7],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          )}

          {/* Orange paw (active state) */}
          {(isActive || isHovered) && (
            <motion.img
              src="/paw.png"
              alt="paw"
              className="absolute inset-0 w-full h-full object-contain"
              style={{
                filter: "brightness(1.1) saturate(0.8) hue-rotate(-10deg)",
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            />
          )}
        </div>

        {/* Label */}
        <div
          className={`mt-1.5 sm:mt-2 text-center text-xs sm:text-sm lg:text-base xl:text-xl font-bold transition-all duration-300 leading-tight max-w-[120px] sm:max-w-none ${
            isActive || isHovered
              ? "text-primary"
              : "text-foreground"
          }`}
          style={{
            textShadow:
              isActive || isHovered
                ? "0 0 6px rgba(251, 146, 60, 0.5), 0 0 12px rgba(251, 146, 60, 0.3)"
                : "none",
          }}
        >
          {label}
        </div>
      </motion.div>
    </div>
  );
};

export default AnimatedPaw;
