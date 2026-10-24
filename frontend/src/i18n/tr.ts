import type { Messages } from "./en";

export const tr: Messages = {
  language: "Dil",
  intro:
    "Tek bir ürünü yeniden stoklayan bir mağaza düşünün. Müşteriler her gün rastgele miktarda ürün alıyor. Bu araç en ucuz stok yenileme kuralını (ne zaman, ne kadar sipariş verileceğini) hesaplar ve iki daha basit kuralla karşılaştırır.",

  header: {
    subtitle: "Akıllı stok yenileme hesaplayıcısı",
    toggleSettings: "Ayarları göster veya gizle",
    resources: "Bağlantılar",
    docs: "API belgeleri",
    github: "GitHub",
  },

  status: {
    checking: "Kontrol ediliyor…",
    online: "Sunucu çevrimiçi",
    offline: "Sunucu çevrimdışı",
    label: (text) => `Sunucu durumu: ${text}`,
  },

  tabs: { summary: "Özet", policy: "Sipariş kuralı", trajectory: "Zaman içinde stok" },

  run: {
    updating: "Güncelleniyor…",
    example: (button) =>
      `Varsayılan ayarlarla örnek sonuçlar. Kendi sayılarınızı kullanmak için “${button}” düğmesine basın.`,
  },

  settings: {
    title: "Ayarlar",
    demand: {
      title: "Talep nasıl davranıyor",
      steady: "Düzenli",
      steadyTech: "Poisson",
      variable: "Dalgalı",
      variableTech: "Negatif binom",
      summary: (mean, spread) => `Günlük ortalama ${mean} · dalgalanma ${spread}`,
      mean: {
        label: "Günlük ortalama (μ)",
        hint: "Ortalama bir günde müşterilerin kaç ürün aldığı.",
      },
      spread: {
        label: "Dalgalanma (σ²)",
        hint: "Günlük talebin ne kadar inip çıktığı. Ortalamadan büyük olmalı.",
      },
    },
    costs: {
      title: "Maliyetler",
      description: "Her sipariş, depodaki her ürün ve eksik kalan her ürün ne kadara mal oluyor.",
      setup: {
        label: "Sipariş başı maliyet (K)",
        hint: "Siparişin büyüklüğü fark etmeksizin, her sipariş verişinizde ödediğiniz sabit ücret.",
      },
      unitOrder: { label: "Ürün fiyatı (c)", hint: "Bir ürünü satın almanın maliyeti." },
      holding: {
        label: "Depolama maliyeti (h)",
        hint: "Bir ürünü depoda bir gün tutmanın maliyeti.",
      },
      shortage: {
        label: "Eksik ürün cezası (p)",
        hint: "Müşterinin istediği ürün stokta olmadığında, ürün başına günlük ceza.",
      },
    },
    planning: {
      title: "Planlama",
      description: "Planın ne kadar ileriye baktığı ve deponun büyüklüğü.",
      gamma: {
        label: "Gelecek ağırlığı (γ)",
        hint: "Yarının maliyetlerinin bugünküne göre ne kadar önemli sayıldığı. 1'e yakın olması neredeyse aynı demektir.",
      },
      leadTime: {
        label: "Teslimat günü (L)",
        hint: "Sipariş vermekle ürünün gelmesi arasındaki gün sayısı.",
      },
      maxBacklog: {
        label: "En çok bekleyen talep (B)",
        hint: "Modelin takip ettiği en yüksek karşılanamamış talep; bu müşteriler sonraki teslimatı bekler.",
      },
      capacity: { label: "Depo kapasitesi (C)", hint: "Deponun alabileceği en çok ürün." },
    },
    simulation: {
      title: "Deneme",
      description: "Planın uydurma günlerde nasıl denendiği.",
      horizon: { label: "Denenen gün (T)", hint: "Her denemenin kaç gün sürdüğü." },
      replications: {
        label: "Deneme sayısı",
        hint: "Denemenin farklı rastgele taleplerle kaç kez tekrarlandığı. Daha çok tekrar, daha kararlı ortalama verir.",
      },
      seed: {
        label: "Rastgelelik tohumu",
        hint: "Rastgeleliği sabitleyen sayı; aynı ayarlar her zaman aynı sonucu verir.",
      },
    },
    calculate: "Hesapla",
    calculating: "Hesaplanıyor…",
    reset: "Ayarları sıfırla",
    footer: {
      method: "Yöntem",
      methodValue: "değer iterasyonu",
      levels: "Stok seviyesi",
      days: "Gün",
      last: "Son hesaplama",
      example: "örnek",
    },
  },

  csv: {
    title: "Kendi satış verileriniz",
    drop: "Günlük satışların CSV dosyasını buraya bırakın",
    choose: "veya dosya seçin",
    uploadLabel: "Günlük satışları CSV dosyası olarak yükle",
    reading: "Verileriniz okunuyor…",
    days: (n) => `${n} günlük veri`,
    summary: (mean, spread, ratio) =>
      `Günlük ortalama ${mean} · dalgalanma ${spread} (ortalamanın ${ratio} katı)`,
    apply: "Bu sayıları kullan",
    errors: {
      empty: "Dosya boş.",
      noColumn: "En az 2 satırlık bir sayı sütunu bulunamadı.",
    },
  },

  formErrors: {
    mu: "Günlük ortalama 0'dan büyük ve en çok 10.000 olmalı.",
    variance: "Dalgalı talepte dalgalanma, ortalamadan büyük olmalı.",
    holding: "Depolama maliyeti 0'dan büyük olmalı.",
    shortage: "Eksik ürün cezası 0'dan büyük olmalı.",
    setup: "Sipariş başı maliyet negatif olamaz.",
    unitOrder: "Ürün fiyatı negatif olamaz.",
    gamma: "Gelecek ağırlığı 0'dan büyük ve en çok 0,995 olmalı.",
    maxBacklog: "En çok bekleyen talep, 0 ile 1.000 arasında bir tam sayı olmalı.",
    capacity: "Depo kapasitesi, 1 ile 1.000 arasında bir tam sayı olmalı.",
    leadTime: "Teslimat günü, 0 ile 30 arasında bir tam sayı olmalı.",
    horizon: "Denenen gün sayısı, en az 1 olan bir tam sayı olmalı.",
    replications: "Deneme sayısı, en az 2 olan bir tam sayı olmalı.",
    workload: (limit) => `Denenen gün × deneme sayısı en çok ${limit} olabilir.`,
    seed: "Rastgelelik tohumu, 0 veya daha büyük bir tam sayı olmalı.",
  },

  errors: {
    unexpected: "Bir şeyler ters gitti.",
    unreachable: "Sunucuya ulaşılamıyor. Hizmet çalışıyor mu?",
    gateway: "Sunucu yanıt vermiyor. Lütfen biraz sonra tekrar deneyin.",
  },

  kpi: {
    savings: {
      label: "Maliyet tasarrufu",
      badge: "basit kurala göre",
      vsEoq: (cheaper, pct) =>
        cheaper
          ? `▲ sabit miktarlı siparişten (EOQ) ${pct} ucuz`
          : `▼ sabit miktarlı siparişten (EOQ) ${pct} pahalı`,
      note: "Basit “seviyeye tamamla” kuralına (Base-Stock) göre",
    },
    rule: {
      label: "Sipariş kuralı",
      labelWithOrders: "Sipariş kuralı (stok + yoldaki siparişler)",
      badge: "(s, S)",
      text: (s, S, cap) =>
        `Stok ${s} veya altına düşünce, ${S} seviyesine ulaşacak kadar sipariş verin. Depo sınırı: ${cap}.`,
      textWithOrders: (s, S, cap) =>
        `Stok ile yoldaki siparişlerin toplamı ${s} veya altına düşünce, ${S} seviyesine ulaşacak kadar sipariş verin. Depo sınırı: ${cap}.`,
      notPure: " Basit, iki sayılı bir kural değil.",
      none: (cap) => `Modellenen aralıkta hiç yeniden sipariş gerekmiyor. Depo sınırı: ${cap}.`,
    },
    service: {
      label: "Eksiksiz stoklu günler",
      badge: "CSL",
      note: "Hiçbir ürünün eksik kalmadığı günlerin oranı (yaygın hedef %95)",
    },
    fill: {
      label: "Karşılanan talep",
      badge: "Karşılama oranı",
      avgStock: (n) => `Ortalama stok: ${n} ürün`,
      risk: (level) => `Stoksuz kalma riski: ${level}`,
      low: "Düşük",
      medium: "Orta",
      high: "Yüksek",
    },
  },

  summary: {
    title: "Kurallar nasıl karşılaştırılıyor",
    subtitle: (days) =>
      `Her kural, tamamen aynı müşteri talebiyle ${days} uydurma gün üzerinde denenir.`,
    columns: {
      rule: "Kural",
      costPerDay: "Günlük maliyet",
      totalCost: "Toplam maliyet",
      noShortage: "Eksiksiz stoklu gün",
      served: "Karşılanan talep",
      outOfStock: "Stoksuz gün",
      avgStock: "Ortalama stok",
      saving: "EOQ'ya göre fark",
    },
    hints: {
      costPerDay: "Günlük ortalama maliyet. ± işaretinden sonraki sayı hata payıdır.",
      saving: "Sabit miktarlı siparişe (EOQ) göre ne kadar ucuz (−) ya da pahalı (+) olduğu.",
    },
    rules: {
      mdp: { name: "MDP (s, S)", tag: "En iyi", spec: "Çözücünün bulduğu en iyi kural" },
      basestock: {
        name: "Base-Stock",
        tag: "Basit",
        spec: "Basit kural: her gün sabit bir seviyeye tamamla",
      },
      static_eoq: {
        name: "Static EOQ",
        tag: "Klasik",
        spec: "Ders kitabı kuralı: hep aynı miktarı sipariş et",
      },
    },
    stats: {
      accuracy: {
        label: "Çözüm doğruluğu",
        note: "olabilecek en iyi sonucun; matematiksel bir hata sınırıyla doğrulandı",
      },
      latency: { label: "Hesaplama süresi", note: "Bilgisayarın kuralı bulması ne kadar sürdü" },
      cost: {
        label: "Beklenen toplam maliyet",
        note: "Uzun vadede tahmini toplam maliyet (sonraki maliyetler biraz daha az sayılır)",
      },
    },
    export: { csv: "CSV indir", pdf: "PDF indir" },
  },

  policy: {
    title: "Her stok seviyesi için en iyi sipariş miktarı",
    hint: "Bir stok seviyesinin sayılarını görmek için fareyi grafiğin üzerinde gezdirin.",
    legendCost: "Beklenen gelecek maliyet (V*)",
    legendOrder: "Sipariş miktarı",
    chartLabel: "Her stok seviyesi için beklenen gelecek maliyet ve en iyi sipariş miktarı grafiği",
    xStock: "Stok seviyesi",
    xPosition: "Stok + yoldaki siparişler",
    tooltipStock: (x) => `Stok seviyesi: ${x}`,
    tooltipCost: "Beklenen maliyet",
    tooltipOrder: "Sipariş miktarı",
    items: (n) => `${n} ürün`,
    chip: (x, cost, order) => `Stok seviyesi ${x} · beklenen maliyet ${cost} · sipariş ${order}`,
    chipIdle: "Stok seviyesi — · beklenen maliyet — · sipariş —",
    rule: "Kural: stok s veya altındaysa S'ye ulaşacak kadar sipariş ver, değilse sipariş verme.",
    solved: (rounds, error) => `${rounds} turda çözüldü · kalan hata ${error}`,
    notPure: " · basit, iki sayılı bir kural değil",
  },

  trajectory: {
    title: (days) => `Zaman içinde stok seviyesi · ${days} gün`,
    hint: "En iyi kural kullanılarak, rastgele müşteri talebiyle simüle edilen tek bir gün dizisi. Sıfırın altı, müşterilerin ürün beklediği anlamına gelir.",
    chartLabel: "Zaman içinde stok seviyesi grafiği",
    legendStock: "Stok",
    legendPosition: "Stok + yoldaki siparişler",
    legendS: "Sipariş noktası (s)",
    legendBigS: "Hedef seviye (S)",
    seriesStock: "Gün sonu stoku",
    seriesPosition: "Stok + yoldaki siparişler",
    seriesOrder: "Verilen sipariş",
    day: (d) => `${d}. gün`,
    dayShort: (d) => `g${d}`,
    stats: {
      orders: "Verilen sipariş",
      stockoutDays: "Stoksuz gün",
      peak: "En yüksek stok",
      cycle: "Siparişler arası gün",
      days: (n) => `${n} gün`,
    },
  },
};
