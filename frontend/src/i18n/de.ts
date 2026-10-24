import type { Messages } from "./en";

export const de: Messages = {
  language: "Sprache",
  intro:
    "Stellen Sie sich ein Geschäft vor, das ein Produkt nachbestellt. Kunden kaufen jeden Tag eine zufällige Menge. Dieses Werkzeug berechnet die günstigste Nachbestellregel (wann und wie viel bestellt wird) und testet sie gegen zwei einfachere Regeln.",

  header: {
    subtitle: "Intelligenter Nachbestell-Rechner",
    toggleSettings: "Einstellungen ein- oder ausblenden",
    resources: "Links",
    docs: "API-Doku",
    github: "GitHub",
  },

  status: {
    checking: "Wird geprüft…",
    online: "Server online",
    offline: "Server offline",
    label: (text) => `Serverstatus: ${text}`,
  },

  tabs: { summary: "Zusammenfassung", policy: "Bestellregel", trajectory: "Bestand im Zeitverlauf" },

  run: {
    updating: "Wird aktualisiert…",
    example: (button) =>
      `Beispielergebnisse mit den Standardeinstellungen. Auf „${button}“ klicken, um eigene Zahlen zu verwenden.`,
  },

  settings: {
    title: "Einstellungen",
    demand: {
      title: "Wie sich die Nachfrage verhält",
      steady: "Gleichmäßig",
      steadyTech: "Poisson",
      variable: "Schwankend",
      variableTech: "Negative Binomial",
      summary: (mean, spread) => `Durchschnitt ${mean} pro Tag · Streuung ${spread}`,
      mean: {
        label: "Ø pro Tag (μ)",
        hint: "Wie viele Stück Kunden an einem durchschnittlichen Tag kaufen.",
      },
      spread: {
        label: "Streuung (σ²)",
        hint: "Wie stark die tägliche Nachfrage schwankt. Muss größer als der Durchschnitt sein.",
      },
    },
    costs: {
      title: "Kosten",
      description: "Was jede Bestellung, jedes gelagerte Stück und jedes fehlende Stück kostet.",
      setup: {
        label: "Kosten je Bestellung (K)",
        hint: "Eine feste Gebühr bei jeder Bestellung, egal wie groß sie ist.",
      },
      unitOrder: { label: "Preis je Stück (c)", hint: "Was ein Stück im Einkauf kostet." },
      holding: {
        label: "Lagerkosten (h)",
        hint: "Was es kostet, ein Stück einen Tag lang im Lager zu halten.",
      },
      shortage: {
        label: "Fehlmengenkosten (p)",
        hint: "Die Strafe pro Tag für jedes Stück, das ein Kunde möchte, aber nicht auf Lager ist.",
      },
    },
    planning: {
      title: "Planung",
      description: "Wie weit der Plan vorausschaut und wie groß das Lager ist.",
      gamma: {
        label: "Gewicht der Zukunft (γ)",
        hint: "Wie stark die Kosten von morgen im Vergleich zu heute zählen. Nahe 1 heißt: fast gleich.",
      },
      leadTime: {
        label: "Lieferzeit in Tagen (L)",
        hint: "Tage zwischen Bestellung und Lieferung.",
      },
      maxBacklog: {
        label: "Max. offene Nachfrage (B)",
        hint: "Die größte unerfüllte Nachfrage, die das Modell verfolgt; diese Kunden warten auf eine spätere Lieferung.",
      },
      capacity: { label: "Lagergröße (C)", hint: "Wie viele Stück das Lager höchstens fasst." },
    },
    simulation: {
      title: "Testen",
      description: "Wie der Plan an erfundenen Tagen getestet wird.",
      horizon: { label: "Getestete Tage (T)", hint: "Wie viele Tage jeder Testlauf dauert." },
      replications: {
        label: "Anzahl Testläufe",
        hint: "Wie oft der Test mit anderer zufälliger Nachfrage wiederholt wird. Mehr Läufe ergeben stabilere Durchschnitte.",
      },
      seed: {
        label: "Zufallswert (Seed)",
        hint: "Eine Zahl, die den Zufall festlegt, damit dieselben Einstellungen immer dieselben Ergebnisse liefern.",
      },
    },
    calculate: "Berechnen",
    calculating: "Berechne…",
    reset: "Einstellungen zurücksetzen",
    footer: {
      method: "Verfahren",
      methodValue: "Value Iteration",
      levels: "Bestandsstufen",
      days: "Tage",
      last: "Letzte Berechnung",
      example: "Beispiel",
    },
  },

  csv: {
    title: "Eigene Verkaufsdaten",
    drop: "CSV-Datei mit täglichen Verkäufen hier ablegen",
    choose: "oder Datei auswählen",
    uploadLabel: "Tägliche Verkäufe als CSV-Datei hochladen",
    reading: "Daten werden gelesen…",
    days: (n) => `${n} Tage an Daten`,
    summary: (mean, spread, ratio) =>
      `Durchschnitt ${mean} pro Tag · Streuung ${spread} (${ratio}-mal der Durchschnitt)`,
    apply: "Diese Zahlen verwenden",
    errors: {
      empty: "Die Datei ist leer.",
      noColumn: "Es wurde keine Zahlenspalte mit mindestens 2 Zeilen gefunden.",
    },
  },

  formErrors: {
    mu: "Der Durchschnitt pro Tag muss über 0 und höchstens bei 10.000 liegen.",
    variance: "Bei schwankender Nachfrage muss die Streuung größer als der Durchschnitt sein.",
    holding: "Die Lagerkosten müssen über 0 liegen.",
    shortage: "Die Fehlmengenkosten müssen über 0 liegen.",
    setup: "Die Kosten je Bestellung dürfen nicht negativ sein.",
    unitOrder: "Der Preis je Stück darf nicht negativ sein.",
    gamma: "Das Gewicht der Zukunft muss über 0 und höchstens bei 0,995 liegen.",
    maxBacklog: "Die max. offene Nachfrage muss eine ganze Zahl von 0 bis 1.000 sein.",
    capacity: "Die Lagergröße muss eine ganze Zahl von 1 bis 1.000 sein.",
    leadTime: "Die Lieferzeit muss eine ganze Zahl von 0 bis 30 Tagen sein.",
    horizon: "Die Zahl der getesteten Tage muss eine ganze Zahl von mindestens 1 sein.",
    replications: "Die Anzahl der Testläufe muss eine ganze Zahl von mindestens 2 sein.",
    workload: (limit) => `Getestete Tage × Testläufe dürfen höchstens ${limit} betragen.`,
    seed: "Der Zufallswert muss eine ganze Zahl ab 0 sein.",
  },

  errors: {
    unexpected: "Etwas ist schiefgelaufen.",
    unreachable: "Der Server ist nicht erreichbar. Läuft der Dienst?",
    gateway: "Der Server antwortet nicht. Bitte gleich noch einmal versuchen.",
  },

  kpi: {
    savings: {
      label: "Kosteneinsparung",
      badge: "ggü. Faustregel",
      vsEoq: (cheaper, pct) =>
        cheaper
          ? `▲ ${pct} günstiger als Bestellung mit fester Menge (EOQ)`
          : `▼ ${pct} teurer als Bestellung mit fester Menge (EOQ)`,
      note: "Verglichen mit der einfachen „Auffüll“-Regel (Base-Stock)",
    },
    rule: {
      label: "Bestellregel",
      labelWithOrders: "Bestellregel (Bestand + bestellte Ware)",
      badge: "(s, S)",
      text: (s, S, cap) =>
        `Fällt der Bestand auf ${s} oder weniger, so viel bestellen, dass ${S} erreicht werden. Lagergrenze: ${cap}.`,
      textWithOrders: (s, S, cap) =>
        `Fällt der Bestand plus bereits bestellte Ware auf ${s} oder weniger, so viel bestellen, dass ${S} erreicht werden. Lagergrenze: ${cap}.`,
      notPure: " Keine einfache Zwei-Zahlen-Regel.",
      none: (cap) => `Im berechneten Bereich ist nie eine Nachbestellung nötig. Lagergrenze: ${cap}.`,
    },
    service: {
      label: "Tage ohne Fehlmenge",
      badge: "CSL",
      note: "Anteil der Tage, an denen nichts gefehlt hat (üblich ist ein Ziel von 95 %)",
    },
    fill: {
      label: "Erfüllte Nachfrage",
      badge: "Servicegrad",
      avgStock: (n) => `Ø Bestand: ${n} Stück`,
      risk: (level) => `Risiko für Fehlbestand: ${level}`,
      low: "Niedrig",
      medium: "Mittel",
      high: "Hoch",
    },
  },

  summary: {
    title: "So schneiden die Regeln ab",
    subtitle: (days) =>
      `Jede Regel wird an ${days} erfundenen Tagen mit genau derselben Kundennachfrage getestet.`,
    columns: {
      rule: "Regel",
      costPerDay: "Kosten pro Tag",
      totalCost: "Gesamtkosten",
      noShortage: "Tage ohne Fehlmenge",
      served: "Erfüllte Nachfrage",
      outOfStock: "Tage ohne Bestand",
      avgStock: "Ø Bestand",
      saving: "Gegenüber EOQ",
    },
    hints: {
      costPerDay: "Durchschnittliche Kosten pro Tag. Die Zahl nach ± ist die Fehlermarge.",
      saving: "Wie viel günstiger (−) oder teurer (+) als Bestellung mit fester Menge (EOQ).",
    },
    rules: {
      mdp: { name: "MDP (s, S)", tag: "Beste", spec: "Beste vom Rechenverfahren gefundene Regel" },
      basestock: {
        name: "Base-Stock",
        tag: "Einfach",
        spec: "Einfache Regel: jeden Tag auf einen festen Bestand auffüllen",
      },
      static_eoq: {
        name: "Static EOQ",
        tag: "Klassisch",
        spec: "Lehrbuchregel: immer dieselbe Menge bestellen",
      },
    },
    stats: {
      accuracy: {
        label: "Genauigkeit der Lösung",
        note: "des bestmöglichen Ergebnisses, mit einer mathematischen Fehlerschranke geprüft",
      },
      latency: { label: "Rechenzeit", note: "Wie lange der Computer für die Regel brauchte" },
      cost: {
        label: "Erwartete Gesamtkosten",
        note: "Geschätzte Gesamtkosten auf lange Sicht (spätere Kosten zählen etwas weniger)",
      },
    },
    export: { csv: "CSV herunterladen", pdf: "PDF herunterladen" },
  },

  policy: {
    title: "Beste Bestellmenge je Bestandsstufe",
    hint: "Mit der Maus über das Diagramm fahren, um die Zahlen einer Bestandsstufe zu sehen.",
    legendCost: "Erwartete künftige Kosten (V*)",
    legendOrder: "Bestellmenge",
    chartLabel: "Diagramm der erwarteten künftigen Kosten und der besten Bestellmenge je Bestandsstufe",
    xStock: "Bestand",
    xPosition: "Bestand + bestellte Ware",
    tooltipStock: (x) => `Bestand: ${x}`,
    tooltipCost: "Erwartete Kosten",
    tooltipOrder: "Bestellmenge",
    items: (n) => `${n} Stück`,
    chip: (x, cost, order) => `Bestand ${x} · erwartete Kosten ${cost} · Bestellung ${order}`,
    chipIdle: "Bestand — · erwartete Kosten — · Bestellung —",
    rule: "Regel: Ist der Bestand höchstens s, so viel bestellen, dass S erreicht wird; sonst nichts bestellen.",
    solved: (rounds, error) => `In ${rounds} Runden gelöst · verbleibender Fehler ${error}`,
    notPure: " · keine einfache Zwei-Zahlen-Regel",
  },

  trajectory: {
    title: (days) => `Bestand im Zeitverlauf · ${days} Tage`,
    hint: "Eine simulierte Tagesfolge mit zufälliger Kundennachfrage nach der besten Regel. Unter null warten Kunden auf Ware.",
    chartLabel: "Diagramm des Bestands im Zeitverlauf",
    legendStock: "Bestand",
    legendPosition: "Bestand + bestellte Ware",
    legendS: "Bestellpunkt (s)",
    legendBigS: "Auffüllniveau (S)",
    seriesStock: "Bestand am Tagesende",
    seriesPosition: "Bestand + bestellte Ware",
    seriesOrder: "Bestellung aufgegeben",
    day: (d) => `Tag ${d}`,
    dayShort: (d) => `T${d}`,
    stats: {
      orders: "Bestellungen",
      stockoutDays: "Tage ohne Bestand",
      peak: "Höchster Bestand",
      cycle: "Tage zwischen Bestellungen",
      days: (n) => `${n} Tage`,
    },
  },
};
