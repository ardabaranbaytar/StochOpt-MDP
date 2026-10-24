// English is the source of truth: `Messages` is its shape, and tr.ts / de.ts must match it
// exactly (a missing key is a compile error). The wording is deliberately plain: a short everyday
// label first, the technical symbol in brackets, so a non-specialist can follow the page.

interface Field {
  label: string;
  /** Longer explanation, shown as a tooltip. */
  hint: string;
}

interface RuleText {
  name: string;
  tag: string;
  spec: string;
}

export const en = {
  language: "Language",
  intro:
    "Picture a shop that restocks one product. Customers buy a random amount every day. This tool works out the cheapest restocking rule (when to order and how much) and tests it against two simpler rules.",

  header: {
    subtitle: "Smart restocking calculator",
    toggleSettings: "Show or hide the settings",
    resources: "Links",
    docs: "API docs",
    github: "GitHub",
  },

  status: {
    checking: "Checking…",
    online: "Server online",
    offline: "Server offline",
    label: (text: string) => `Server status: ${text}`,
  },

  tabs: { summary: "Summary", policy: "Ordering rule", trajectory: "Stock over time" },

  run: {
    updating: "Updating…",
    example: (button: string) =>
      `Example results with the default settings. Press “${button}” to use your own numbers.`,
  },

  settings: {
    title: "Settings",
    demand: {
      title: "How demand behaves",
      steady: "Steady",
      steadyTech: "Poisson",
      variable: "Variable",
      variableTech: "Negative binomial",
      summary: (mean: string, spread: string) => `Average ${mean} per day · spread ${spread}`,
      mean: {
        label: "Average per day (μ)",
        hint: "How many items customers buy on an average day.",
      } satisfies Field,
      spread: {
        label: "Spread (σ²)",
        hint: "How much daily demand jumps around. Must be larger than the average.",
      } satisfies Field,
    },
    costs: {
      title: "Costs",
      description: "What each order, each stored item and each missing item costs.",
      setup: {
        label: "Cost per order (K)",
        hint: "A fixed fee you pay every time you place an order, however big it is.",
      } satisfies Field,
      unitOrder: { label: "Price per item (c)", hint: "What one item costs to buy." } satisfies Field,
      holding: {
        label: "Storage cost (h)",
        hint: "What it costs to keep one item in the warehouse for one day.",
      } satisfies Field,
      shortage: {
        label: "Shortage cost (p)",
        hint: "The penalty, per day, for each item a customer wants that is not in stock.",
      } satisfies Field,
    },
    planning: {
      title: "Planning",
      description: "How far ahead the plan looks and how big the warehouse is.",
      gamma: {
        label: "Future weight (γ)",
        hint: "How much tomorrow's costs count compared with today's. Close to 1 means almost the same.",
      } satisfies Field,
      leadTime: {
        label: "Delivery days (L)",
        hint: "Days between placing an order and receiving it.",
      } satisfies Field,
      maxBacklog: {
        label: "Max. unmet demand (B)",
        hint: "The most unmet demand the model keeps track of; those customers wait for a later delivery.",
      } satisfies Field,
      capacity: { label: "Warehouse size (C)", hint: "The most items the warehouse can hold." } satisfies Field,
    },
    simulation: {
      title: "Testing",
      description: "How the plan is tested on made-up days.",
      horizon: { label: "Days tested (T)", hint: "How many days each test run lasts." } satisfies Field,
      replications: {
        label: "Test runs",
        hint: "How many times the test is repeated with different random demand. More runs give steadier averages.",
      } satisfies Field,
      seed: {
        label: "Random seed",
        hint: "A number that fixes the randomness, so the same settings always give the same results.",
      } satisfies Field,
    },
    calculate: "Calculate",
    calculating: "Calculating…",
    reset: "Reset settings",
    footer: {
      method: "Method",
      methodValue: "value iteration",
      levels: "Stock levels",
      days: "Days",
      last: "Last calculation",
      example: "example",
    },
  },

  csv: {
    title: "Your own sales data",
    drop: "Drop a CSV file of daily sales here",
    choose: "or choose a file",
    uploadLabel: "Upload daily sales as a CSV file",
    reading: "Reading your data…",
    days: (n: number) => `${n} days of data`,
    summary: (mean: string, spread: string, ratio: string) =>
      `Average ${mean} per day · spread ${spread} (${ratio}× the average)`,
    apply: "Use these numbers",
    errors: {
      empty: "The file is empty.",
      noColumn: "No column of numbers with at least 2 rows was found.",
    },
  },

  formErrors: {
    mu: "The average per day must be more than 0 and at most 10,000.",
    variance: "For variable demand, the spread must be larger than the average.",
    holding: "The storage cost must be more than 0.",
    shortage: "The shortage cost must be more than 0.",
    setup: "The cost per order cannot be negative.",
    unitOrder: "The price per item cannot be negative.",
    gamma: "The future weight must be more than 0 and at most 0.995.",
    maxBacklog: "The max. unmet demand must be a whole number from 0 to 1,000.",
    capacity: "The warehouse size must be a whole number from 1 to 1,000.",
    leadTime: "The delivery time must be a whole number of days from 0 to 30.",
    horizon: "The days tested must be a whole number, at least 1.",
    replications: "The number of test runs must be a whole number, at least 2.",
    workload: (limit: string) => `Days tested × test runs must not be more than ${limit}.`,
    seed: "The random seed must be a whole number, 0 or more.",
  },

  errors: {
    unexpected: "Something went wrong.",
    unreachable: "Cannot reach the server. Is the service running?",
    gateway: "The server is not responding. Please try again in a moment.",
  },

  kpi: {
    savings: {
      label: "Cost savings",
      badge: "vs. simple rule",
      vsEoq: (cheaper: boolean, pct: string) =>
        cheaper
          ? `▲ ${pct} cheaper than fixed-size ordering (EOQ)`
          : `▼ ${pct} costlier than fixed-size ordering (EOQ)`,
      note: "Compared with the simple “top up” rule (Base-Stock)",
    },
    rule: {
      label: "Order rule",
      labelWithOrders: "Order rule (stock + orders on the way)",
      badge: "(s, S)",
      text: (s: number, S: number, cap: number) =>
        `When stock falls to ${s} or below, order enough to get back up to ${S}. Warehouse limit: ${cap}.`,
      textWithOrders: (s: number, S: number, cap: number) =>
        `When stock plus orders already on the way falls to ${s} or below, order enough to reach ${S}. Warehouse limit: ${cap}.`,
      notPure: " Not a simple two-number rule.",
      none: (cap: number) => `No reorder is ever needed in the modelled range. Warehouse limit: ${cap}.`,
    },
    service: {
      label: "Days without a shortage",
      badge: "CSL",
      note: "Share of days with nothing missing (a common goal is 95%)",
    },
    fill: {
      label: "Demand served",
      badge: "Fill rate",
      avgStock: (n: string) => `Average stock: ${n} items`,
      risk: (level: string) => `Risk of running out: ${level}`,
      low: "Low",
      medium: "Medium",
      high: "High",
    },
  },

  summary: {
    title: "How the rules compare",
    subtitle: (days: number) =>
      `Each rule is tested on ${days} made-up days with exactly the same customer demand.`,
    columns: {
      rule: "Rule",
      costPerDay: "Cost per day",
      totalCost: "Total cost",
      noShortage: "Days without shortage",
      served: "Demand served",
      outOfStock: "Days out of stock",
      avgStock: "Average stock",
      saving: "Compared with EOQ",
    },
    hints: {
      costPerDay: "Average cost per day. The number after ± is the margin of error.",
      saving: "How much cheaper (−) or costlier (+) than fixed-size ordering (EOQ).",
    },
    rules: {
      mdp: {
        name: "MDP (s, S)",
        tag: "Best",
        spec: "Best rule found by the solver",
      } satisfies RuleText,
      basestock: {
        name: "Base-Stock",
        tag: "Simple",
        spec: "Simple rule: top up to a fixed level every day",
      } satisfies RuleText,
      static_eoq: {
        name: "Static EOQ",
        tag: "Classic",
        spec: "Textbook rule: always order the same amount",
      } satisfies RuleText,
    },
    stats: {
      accuracy: {
        label: "Solver accuracy",
        note: "of the best possible result, checked with a mathematical error bound",
      },
      latency: { label: "Calculation time", note: "How long the computer took to find the rule" },
      cost: {
        label: "Expected total cost",
        note: "Estimated total cost over the long run (later costs count a little less)",
      },
    },
    export: { csv: "Download CSV", pdf: "Download PDF" },
  },

  policy: {
    title: "Best order size for each stock level",
    hint: "Move the mouse over the chart to see the numbers for one stock level.",
    legendCost: "Expected future cost (V*)",
    legendOrder: "Order size",
    chartLabel: "Chart of the expected future cost and the best order size for each stock level",
    xStock: "Stock level",
    xPosition: "Stock + orders on the way",
    tooltipStock: (x: number) => `Stock level: ${x}`,
    tooltipCost: "Expected cost",
    tooltipOrder: "Order size",
    items: (n: number) => `${n} items`,
    chip: (x: number, cost: string, order: number) =>
      `Stock level ${x} · expected cost ${cost} · order ${order}`,
    chipIdle: "Stock level — · expected cost — · order —",
    rule: "Rule: if stock is at or below s, order enough to reach S; otherwise order nothing.",
    solved: (rounds: number, error: string) => `Solved in ${rounds} rounds · remaining error ${error}`,
    notPure: " · not a simple two-number rule",
  },

  trajectory: {
    title: (days: number) => `Stock level over time · ${days} days`,
    hint: "One simulated stretch of days with random customer demand, using the best rule. Below zero means customers are waiting for stock.",
    chartLabel: "Chart of the stock level over time",
    legendStock: "Stock",
    legendPosition: "Stock + orders on the way",
    legendS: "Reorder point (s)",
    legendBigS: "Refill level (S)",
    seriesStock: "Stock at end of day",
    seriesPosition: "Stock + orders on the way",
    seriesOrder: "Order placed",
    day: (d: number) => `Day ${d}`,
    dayShort: (d: number) => `d${d}`,
    stats: {
      orders: "Orders placed",
      stockoutDays: "Days out of stock",
      peak: "Highest stock",
      cycle: "Days between orders",
      days: (n: string) => `${n} days`,
    },
  },
};

export type Messages = typeof en;
