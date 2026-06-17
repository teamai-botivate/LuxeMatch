import { z } from 'zod';

export const InsightSeveritySchema = z.enum(['info', 'warn', 'critical']);
export type InsightSeverity = z.infer<typeof InsightSeveritySchema>;

export const InsightSchema = z.object({
  id: z.string(),
  headline: z.string(),
  body: z.string(),
  recommendation: z.string(),
  relatedProductIds: z.array(z.string().uuid()),
  severity: InsightSeveritySchema,
});
export type Insight = z.infer<typeof InsightSchema>;

export const RecommendationActionSchema = z.enum([
  'stock_more',
  'keep_visible',
  'review_price',
  'reduce_stock',
  'season_ready',
  'trending_up',
  'stalled_interest',
]);
export type RecommendationAction = z.infer<typeof RecommendationActionSchema>;

export const RecommendationSchema = z.object({
  id: z.string(),
  action: RecommendationActionSchema,
  title: z.string(),
  reason: z.string(),
  nextStep: z.string(),
  priority: z.enum(['low', 'medium', 'high']),
  confidence: z.enum(['low', 'medium', 'high']),
  score: z.number(),
  relatedProductIds: z.array(z.string().uuid()),
  season: z.string().optional(),
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

export type ProductDemandSnapshot = {
  productId: string;
  name: string;
  slug: string;
  categoryName: string | null;
  metal: string | null;
  occasionTags: string[];
  stockCount: number;
  priceMin: number | null;
  primaryImageUrl: string | null;
  sales30: number;
  sales90: number;
  revenue90: number;
  views30: number;
  views90: number;
  tryons30: number;
  tryons90: number;
  lastSoldAt: string | null;
};

/**
 * Seasonal windows are stored as recurring MONTH/DAY anchors (1-based month),
 * NOT absolute dates — so the same definitions keep working every year. The
 * concrete `startsAt`/`endsAt` for the current cycle are computed relative to
 * `now` in `getUpcomingSeason` (handling year-wraparound for windows that span
 * a year boundary or whose start has already passed this year).
 */
export type SeasonalWindowDef = {
  label: string;
  /** 1-based month + day-of-month for the window start. */
  start: { month: number; day: number };
  /** 1-based month + day-of-month for the window end. */
  end: { month: number; day: number };
  tags: string[];
  stockFocus: string[];
};

/** A seasonal window resolved to concrete ISO dates for a specific cycle. */
export type SeasonalWindow = {
  label: string;
  startsAt: string;
  endsAt: string;
  tags: string[];
  stockFocus: string[];
};

export const INDIAN_SEASONAL_WINDOWS: SeasonalWindowDef[] = [
  {
    label: 'Wedding season',
    start: { month: 10, day: 15 },
    end: { month: 12, day: 20 },
    tags: ['wedding', 'bridal'],
    stockFocus: ['necklace', 'set', 'bangle', 'earring', 'choker'],
  },
  {
    label: 'Festive season',
    start: { month: 9, day: 15 },
    end: { month: 11, day: 15 },
    tags: ['festival'],
    stockFocus: ['gold', 'bangle', 'earring', 'necklace', 'daily'],
  },
  {
    label: 'Gift season',
    start: { month: 7, day: 15 },
    end: { month: 8, day: 31 },
    tags: ['gift', 'daily'],
    stockFocus: ['pendant', 'earring', 'ring', 'rose_gold'],
  },
];

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Resolve a recurring window definition to the next concrete cycle relative to
 * `now`. If this year's start has already passed, roll to next year's cycle. End
 * dates that fall before the start (e.g. a Dec→Jan window) roll into the
 * following year.
 */
function resolveWindow(def: SeasonalWindowDef, now: Date): { window: SeasonalWindow; startsMs: number } {
  const baseYear = now.getUTCFullYear();
  const startThisYear = Date.UTC(baseYear, def.start.month - 1, def.start.day);
  const nowMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const startYear = startThisYear >= nowMs ? baseYear : baseYear + 1;
  const startsMs = Date.UTC(startYear, def.start.month - 1, def.start.day);
  // End rolls to the next year if it sorts before the start within a calendar year.
  const endYear = def.end.month < def.start.month
    || (def.end.month === def.start.month && def.end.day < def.start.day)
    ? startYear + 1
    : startYear;
  return {
    startsMs,
    window: {
      label: def.label,
      startsAt: isoDate(startYear, def.start.month, def.start.day),
      endsAt: isoDate(endYear, def.end.month, def.end.day),
      tags: def.tags,
      stockFocus: def.stockFocus,
    },
  };
}

export function getUpcomingSeason(
  now = new Date(),
  windows: SeasonalWindowDef[] = INDIAN_SEASONAL_WINDOWS,
): SeasonalWindow | null {
  return (
    windows
      .map((def) => resolveWindow(def, now))
      .sort((a, b) => a.startsMs - b.startsMs)[0]?.window ?? null
  );
}

function demandScore(product: ProductDemandSnapshot): number {
  return (
    product.sales90 * 8 +
    product.tryons90 * 2.5 +
    product.views90 * 0.25 +
    product.revenue90 / 100_000
  );
}

/**
 * Ratio of the 30-day rate (annualised to 90d) vs the 90-day rate.
 * > 1.3 = accelerating demand; < 0.4 = decelerating.
 */
function velocityRatio(product: ProductDemandSnapshot): number {
  const rate30 = product.sales30 * 3;
  const rate90 = product.sales90;
  if (rate90 === 0) return rate30 > 0 ? 2.0 : 1.0;
  return rate30 / rate90;
}

/** Penalise score for products that haven't sold recently. */
function recencyMultiplier(product: ProductDemandSnapshot, now: Date): number {
  if (!product.lastSoldAt) return 0.7;
  const daysSince = (now.getTime() - new Date(product.lastSoldAt).getTime()) / 86_400_000;
  if (daysSince < 14) return 1.0;
  if (daysSince < 45) return 0.85;
  if (daysSince < 90) return 0.70;
  return 0.50;
}

function weightedScore(product: ProductDemandSnapshot, now: Date): number {
  return demandScore(product) * recencyMultiplier(product, now);
}

function confidenceFor(productCount: number, signalCount: number): Recommendation['confidence'] {
  if (productCount >= 12 && signalCount >= 80) return 'high';
  if (productCount >= 6 && signalCount >= 25) return 'medium';
  return 'low';
}

function productLabel(product: ProductDemandSnapshot): string {
  const bits = [product.metal, product.categoryName].filter(Boolean);
  return bits.length ? bits.join(' ') : product.name;
}

export function generateInventoryRecommendations(
  products: ProductDemandSnapshot[],
  now = new Date(),
): Recommendation[] {
  const signalCount = products.reduce(
    (sum, p) => sum + p.sales90 + p.tryons90 + p.views90,
    0,
  );
  const confidence = confidenceFor(products.length, signalCount);
  const upcomingSeason = getUpcomingSeason(now);
  const recommendations: Recommendation[] = [];

  // ── Hot low stock ──────────────────────────────────────────────────────────
  const hotLowStock = products
    .filter((p) => p.sales30 >= 2 && p.stockCount <= Math.max(2, p.sales30))
    .sort((a, b) => weightedScore(b, now) - weightedScore(a, now))[0];

  if (hotLowStock) {
    recommendations.push({
      id: `stock-more-${hotLowStock.productId}`,
      action: 'stock_more',
      title: `Immediate restock suggested for ${productLabel(hotLowStock)}`,
      reason: `${hotLowStock.name} sold ${hotLowStock.sales30} units in 30 days, generated ${hotLowStock.tryons30} try-ons, and only ${hotLowStock.stockCount} are left.`,
      nextStep: `Reorder ${Math.max(4, hotLowStock.sales30 * 2)} units or add similar designs this week to avoid missed demand.`,
      priority: 'high',
      confidence,
      score: weightedScore(hotLowStock, now),
      relatedProductIds: [hotLowStock.productId],
    });
  }

  // ── Trending up: demand accelerating in the last 30d vs 90d baseline ──────
  const trendingUp = products
    .filter((p) => velocityRatio(p) > 1.3 && p.sales90 >= 3 && p.stockCount > 0)
    .sort((a, b) => velocityRatio(b) - velocityRatio(a))[0];

  if (trendingUp) {
    const vel = velocityRatio(trendingUp);
    const avg30dBase = Math.round(trendingUp.sales90 / 3);
    recommendations.push({
      id: `trending-up-${trendingUp.productId}`,
      action: 'trending_up',
      title: `Demand accelerating for ${productLabel(trendingUp)}`,
      reason: `${trendingUp.name} sold ${trendingUp.sales30} times this month vs ~${avg30dBase} per month over the past 90 days — ${Math.round(vel * 100 - 100)}% faster.`,
      nextStep: 'Feature it prominently and ensure adequate stock for the next 4 weeks.',
      priority: 'high',
      confidence,
      score: weightedScore(trendingUp, now) * vel,
      relatedProductIds: [trendingUp.productId],
    });
  }

  // ── High interest, low conversion ─────────────────────────────────────────
  const highInterestLowSale = products
    .filter((p) => p.sales30 === 0 && p.tryons30 >= 4)
    .sort((a, b) => b.tryons30 - a.tryons30)[0];

  if (highInterestLowSale) {
    recommendations.push({
      id: `review-price-${highInterestLowSale.productId}`,
      action: 'review_price',
      title: `Conversion review needed for ${highInterestLowSale.name}`,
      reason: `Customers tried it ${highInterestLowSale.tryons30} times in 30 days and viewed it ${highInterestLowSale.views30} times, but no sale was recorded.`,
      nextStep: 'Review price, making charges, display placement, staff pitch, or keep a lighter variant nearby.',
      priority: 'medium',
      confidence,
      score: demandScore(highInterestLowSale),
      relatedProductIds: [highInterestLowSale.productId],
    });
  }

  // ── Stalled interest: had try-ons but engagement dropped off ──────────────
  const stalledInterest = products
    .filter((p) => p.tryons90 >= 5 && p.tryons30 === 0 && p.sales90 === 0)
    .sort((a, b) => b.tryons90 - a.tryons90)[0];

  if (stalledInterest) {
    recommendations.push({
      id: `stalled-${stalledInterest.productId}`,
      action: 'stalled_interest',
      title: `Customer interest dropped for ${stalledInterest.name}`,
      reason: `${stalledInterest.name} had ${stalledInterest.tryons90} try-ons over 90 days but zero in the last 30, with no sale recorded.`,
      nextStep: 'Move to a new display position, adjust price, or bundle with a bestseller to reignite interest.',
      priority: 'medium',
      confidence,
      score: stalledInterest.tryons90 * 0.5,
      relatedProductIds: [stalledInterest.productId],
    });
  }

  // ── Slow moving ───────────────────────────────────────────────────────────
  const slowMoving = products
    .filter((p) => p.stockCount >= 8 && p.sales90 === 0 && p.views90 < 20)
    .sort((a, b) => b.stockCount - a.stockCount)[0];

  if (slowMoving) {
    recommendations.push({
      id: `reduce-stock-${slowMoving.productId}`,
      action: 'reduce_stock',
      title: `Pause fresh buying for ${productLabel(slowMoving)}`,
      reason: `${slowMoving.name} has ${slowMoving.stockCount} units, low views, and no sale in 90 days.`,
      nextStep: 'Avoid reordering now; move it into a bundle, offer styling help, or replace with faster designs.',
      priority: 'medium',
      confidence,
      score: Math.max(1, slowMoving.stockCount),
      relatedProductIds: [slowMoving.productId],
    });
  }

  // ── Season readiness ──────────────────────────────────────────────────────
  if (upcomingSeason) {
    const seasonalProducts = products
      .filter((p) => {
        const haystack = [
          p.categoryName?.toLowerCase() ?? '',
          p.metal?.toLowerCase() ?? '',
          ...p.occasionTags.map((tag) => tag.toLowerCase()),
        ];
        return upcomingSeason.tags.some((tag) => haystack.includes(tag));
      })
      .sort((a, b) => weightedScore(b, now) - weightedScore(a, now))
      .slice(0, 3);

    if (seasonalProducts.length > 0) {
      const lowStockCount = seasonalProducts.filter((p) => p.stockCount <= 3).length;
      recommendations.push({
        id: `season-ready-${upcomingSeason.label.toLowerCase().replace(/\s+/g, '-')}`,
        action: 'season_ready',
        title: `Prepare inventory for ${upcomingSeason.label}`,
        reason: `${seasonalProducts.length} relevant products have demand signals; ${lowStockCount} are low-stock.`,
        nextStep: `Prioritize ${upcomingSeason.stockFocus.slice(0, 3).join(', ')} inventory and refresh display collections.`,
        priority: lowStockCount > 0 ? 'high' : 'medium',
        confidence,
        score: seasonalProducts.reduce((sum, p) => sum + weightedScore(p, now), 0),
        relatedProductIds: seasonalProducts.map((p) => p.productId),
        season: upcomingSeason.label,
      });
    }
  }

  // ── Fallback: keep top product visible ────────────────────────────────────
  if (recommendations.length === 0) {
    const topInterest = [...products].sort((a, b) => weightedScore(b, now) - weightedScore(a, now))[0];
    if (topInterest) {
      recommendations.push({
        id: `keep-visible-${topInterest.productId}`,
        action: 'keep_visible',
        title: `Keep ${topInterest.name} visible`,
        reason: 'This product currently has the strongest combined demand signal in your catalogue.',
        nextStep: 'Place it in the first screen of the store catalogue and keep staff aware of its talking points.',
        priority: 'low',
        confidence,
        score: weightedScore(topInterest, now),
        relatedProductIds: [topInterest.productId],
      });
    }
  }

  return recommendations
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

export const PACKAGE_NAME = '@luxematch/intelligence';
