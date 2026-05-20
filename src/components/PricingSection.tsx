import { TrendingDown, Layers, Wrench, Star } from "lucide-react";

type Plan = {
  name: string;
  price: string;
  priceNote?: string;
  model: string;
  rate: string;
  notes: string;
  dotColor: string;
  isPawX?: boolean;
};

const plans: Plan[] = [
  {
    name: "PawX",
    price: "$0.001",
    priceNote: "$1.00 per account",
    model: "Account-based",
    rate: "1000 req/sec",
    notes: "Best value on market · Web3-curated dataset · Lowest $/tweet",
    dotColor: "bg-gradient-orange",
    isPawX: true,
  },
  {
    name: "TwitterAPI.io",
    price: "$0.15",
    model: "Pay-as-you-go",
    rate: "1000 req/sec",
    notes: "Per-call minimum charge · General-purpose, no Web3 curation",
    dotColor: "bg-yellow-500",
  },
  {
    name: "Rapid API (twttrapi)",
    price: "$0.25",
    model: "Monthly subscription",
    rate: "10 req/sec",
    notes: "Locked monthly fee · Hard request cap with bandwidth overage at $0.001/MB",
    dotColor: "bg-blue-500",
  },
  {
    name: "Apify (Tweet Scraper V2)",
    price: "$0.40",
    model: "Pay-as-you-go",
    rate: "100 req/sec",
    notes: "Scraper-based · 10× slower throughput · Free plan capped at 10 items",
    dotColor: "bg-orange-500",
  },
  {
    name: "X Official API v2",
    price: "$5.00",
    model: "Pay-per-use",
    rate: "6 req/sec",
    notes: "Strict rate limits · 2M reads/month cap · No Web3 specialization",
    dotColor: "bg-red-500",
  },
];

const advantages = [
  {
    icon: Wrench,
    title: "Built For Your Stack",
    text: "KOL Followers signal + custom feature development.",
  },
  {
    icon: Layers,
    title: "Full Account Context",
    text: "Posts, replies, retweets, deleted tweets, reference tweets in one feed.",
  },
  {
    icon: TrendingDown,
    title: "Lowest Price",
    text: "Up to 5,000× cheaper than X Official API.",
  },
];

const PricingSection = () => {
  return (
    <section id="pricing" className="py-24 px-6 bg-secondary/30">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="px-4 py-2 bg-primary/10 rounded-full text-sm font-bold text-primary mb-4 inline-block">
            PRICING
          </span>
          <h2 className="hero-title text-4xl md:text-6xl lg:text-7xl text-foreground mb-6">
            <span className="gradient-text">BEST VALUE</span>
            <br />
            <span className="text-foreground">PRICING</span>
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto font-semibold">
            Account-based pricing. Predictable, transparent, and a fraction of the cost of every alternative.
          </p>
        </div>

        {/* Comparison Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 sm:gap-6 mb-12">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative p-6 rounded-2xl backdrop-blur-sm border-2 transition-all duration-300 hover:-translate-y-1 ${
                plan.isPawX
                  ? "bg-white dark:bg-card border-primary shadow-[0_8px_30px_rgba(251,146,60,0.25)] lg:scale-[1.04]"
                  : "bg-white/80 dark:bg-card/80 border-orange-100 dark:border-orange-900/30 hover:border-orange-200 dark:hover:border-orange-800/50 shadow-[0_4px_20px_rgba(251,146,60,0.08)]"
              }`}
            >
              {plan.isPawX && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-orange rounded-full text-xs font-bold text-white shadow-button whitespace-nowrap flex items-center gap-1">
                  <Star className="w-3 h-3 fill-white" />
                  BEST VALUE
                </div>
              )}

              <div className="flex items-center gap-2 mb-4">
                <span className={`w-3 h-3 rounded-full ${plan.dotColor}`} />
                <h3 className="text-base font-bold text-foreground leading-tight">
                  {plan.name}
                </h3>
              </div>

              <div className="mb-5">
                <div className="flex items-baseline gap-1">
                  <span
                    className={`text-3xl font-black ${
                      plan.isPawX ? "gradient-text" : "text-foreground"
                    }`}
                  >
                    {plan.price}
                  </span>
                  <span className="text-xs text-muted-foreground font-semibold">
                    / 1K tweets
                  </span>
                </div>
                {plan.priceNote && (
                  <span className="text-xs text-primary font-bold">
                    {plan.priceNote}
                  </span>
                )}
              </div>

              <ul className="space-y-2 text-sm">
                <li className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Model</span>
                  <span className="font-semibold text-foreground text-right">
                    {plan.model}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Rate</span>
                  <span className="font-semibold text-foreground text-right">
                    {plan.rate}
                  </span>
                </li>
                <li className="text-xs text-muted-foreground pt-3 mt-2 border-t border-border/50 leading-relaxed">
                  {plan.notes}
                </li>
              </ul>
            </div>
          ))}
        </div>

        {/* Scope disclaimer */}
        <p className="text-[11px] text-muted-foreground/80 italic text-center mb-10 max-w-3xl mx-auto leading-relaxed">
          * PawX pricing only applies to our curated dataset of 500,000+ Web3 accounts. Payment is settled in credits (1 API Call = 1 credit).
        </p>

        {/* Advantages */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          {advantages.map((adv, i) => (
            <div
              key={i}
              className="glass-card p-6 flex items-start gap-4 hover:-translate-y-1 transition-transform"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-orange flex items-center justify-center shrink-0 shadow-soft">
                <adv.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="text-base font-bold text-foreground mb-1">
                  {adv.title}
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {adv.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
