import { useState, useEffect } from "react";

let dynamicLogos: Record<string, string> = {};
let fetched = false;

function fetchDynamicLogos() {
  if (fetched) return;
  fetched = true;
  fetch("/api/stock-logos")
    .then(r => r.json())
    .then((data: { logos: Record<string, string> }) => {
      dynamicLogos = data.logos || {};
    })
    .catch(() => {});
}

const STOCK_LOGOS: Record<string, { logo: string; bg: string }> = {
  "마키나락스": { logo: "/logos/makinarocks.png", bg: "#111111" },
  "매드업": { logo: "/logos/madup.png", bg: "#003DA5" },
  "피스피스스튜디오": { logo: "https://static.ustockplus.com/admin/2026-01/ca30c94f-34fd-4138-af85-c4ed71156691.png", bg: "#111111" },
  "케이뱅크": { logo: "https://static.ustockplus.com/logo/stock/279570.png", bg: "#E8344E" },
  "두나무": { logo: "https://static.ustockplus.com/admin/2023-01/2d2f17bd-097c-4011-931f-6c73c7b7b694.png", bg: "#333333" },
  "빗썸": { logo: "https://static.ustockplus.com/logo/stock/341650.png", bg: "#E8344E" },
  "무신사": { logo: "https://static.ustockplus.com/admin/2023-12/694577d0-9b8c-40f3-94fa-8ae34891c1e4.png", bg: "#111111" },
  "오아시스": { logo: "https://static.ustockplus.com/admin/2023-01/bbb364a1-7dbd-49ea-8f5e-845b91b16967.png", bg: "#4CAF50" },
  "컬리": { logo: "https://static.ustockplus.com/logo/stock/408480.png", bg: "#5F0080" },
  "마켓컬리": { logo: "https://static.ustockplus.com/logo/stock/408480.png", bg: "#5F0080" },
  "에스엠랩": { logo: "https://static.ustockplus.com/logo/company/2768.png", bg: "#2196F3" },
  "야놀자": { logo: "https://static.ustockplus.com/admin/2025-05/a7e5b7ed-4b35-4a76-ab0d-1599271e9696.png", bg: "#E8344E" },
  "케이솔루션": { logo: "https://static.ustockplus.com/admin/2023-04/d9a62c72-0d34-4e9a-b87e-ab11e1339567.png", bg: "#43A047" },
  "에너진": { logo: "https://static.ustockplus.com/admin/2023-01/aa0c30f3-dc2a-409b-a4b6-73f55d159c63.png", bg: "#E65100" },
  "토스": { logo: "https://static.ustockplus.com/admin/2022-09/2075df61-33e0-4ecc-ba42-b95ebf15705a.png", bg: "#3182f6" },
  "비바리퍼블리카": { logo: "https://static.ustockplus.com/admin/2022-09/2075df61-33e0-4ecc-ba42-b95ebf15705a.png", bg: "#3182f6" },
  "현대엔지니어링": { logo: "https://static.ustockplus.com/admin/2023-01/d9602423-0b56-419f-8737-8d30c015e379.png", bg: "#003DA5" },
  "이브이알스튜디오": { logo: "https://static.ustockplus.com/logo/company/563.png", bg: "#6B4CE6" },
  "에스팀": { logo: "https://static.ustockplus.com/admin/2025-09/414cc8ab-b009-41ba-b180-e5f2ba97a32e.png", bg: "#333333" },
  "서울로보틱스": { logo: "https://static.ustockplus.com/logo/company/76915.png", bg: "#333333" },
  "에이치디현대삼호": { logo: "https://static.ustockplus.com/admin/2023-01/d9602423-0b56-419f-8737-8d30c015e379.png", bg: "#1976D2" },
  "카카오모빌리티": { logo: "https://static.ustockplus.com/logo/company/99.png", bg: "#FEE500" },
  "현대카드": { logo: "https://static.ustockplus.com/admin/2023-01/ec31a6fe-2148-477e-bdde-e6efcfd95224.png", bg: "#333333" },
  "스트라드비젼": { logo: "https://static.ustockplus.com/logo/company/77183.png", bg: "#1976D2" },
  "코스모로보틱스": { logo: "https://static.ustockplus.com/logo/company/62977.png", bg: "#333333" },
  "뱅크샐러드": { logo: "https://static.ustockplus.com/logo/company/1103.png", bg: "#00C853" },
  "카나프테라퓨틱스": { logo: "https://static.ustockplus.com/logo/company/77417.png", bg: "#333333" },
  "에임드바이오": { logo: "https://static.ustockplus.com/logo/company/77551.png", bg: "#43A047" },
  "직방": { logo: "https://static.ustockplus.com/logo/company/1419.png", bg: "#333333" },
  "당근": { logo: "https://static.ustockplus.com/logo/company/1424.png", bg: "#FF6F00" },
  "원스토어": { logo: "https://static.ustockplus.com/logo/company/1105.png", bg: "#E8344E" },
  "지그재그": { logo: "https://static.ustockplus.com/logo/company/1427.png", bg: "#333333" },
  "클래스101": { logo: "https://static.ustockplus.com/logo/company/1428.png", bg: "#E8344E" },
  "리센스메디컬": { logo: "https://static.ustockplus.com/logo/company/105.png", bg: "#1976D2" },
  "넷마블몬스터": { logo: "https://static.ustockplus.com/logo/stock/214490.png", bg: "#333333" },
  "한패스": { logo: "/logos/hanpass.png", bg: "#00B4D8" },
  "아이엠바이오로직스": { logo: "/logos/imbiologics.png", bg: "#1976D2" },
  "니어스랩": { logo: "/logos/nearthlab.png", bg: "#FFFFFF" },
  "브릴스": { logo: "/logos/brils.png", bg: "#FFFFFF" },
  "비상장주식": { logo: "", bg: "#E8344E" },
  "채비": { logo: "https://static.ustockplus.com/admin/2025-09/af81f310-052a-47ea-9513-f07128a6e1e9.png", bg: "#2E7D32" },
  "인벤테라": { logo: "https://static.ustockplus.com/admin/2025-09/ef2e1aca-f93b-4c6f-b63e-37a456f41b79.png", bg: "#1565C0" },
  "레몬헬스케어": { logo: "/logos/lemonhealthcare.png", bg: "#E8344E" },
  "케이피항공산업": { logo: "https://static.ustockplus.com/admin/2023-04/2e34a914-1d1c-4a8c-88dd-42351b3fc190.png", bg: "#1565C0" },
  "스트라드비전": { logo: "https://static.ustockplus.com/logo/company/77183.png", bg: "#1976D2" },
  "제이비케이랩": { logo: "https://static.ustockplus.com/admin/2023-01/06aac63c-465d-433f-bc74-8ce6e484d613.png", bg: "#E8344E" },
  "넷마블에프앤씨": { logo: "https://static.ustockplus.com/admin/2022-09/ef54387d-559d-45e9-85d1-1e11b5fbabb6.png", bg: "#1A237E" },
  "교보생명보험": { logo: "", bg: "#E8344E" },
  "현대오일뱅크": { logo: "", bg: "#003DA5" },
  "한국증권금융": { logo: "", bg: "#003DA5" },
  "덕산넵코어스": { logo: "https://static.ustockplus.com/admin/2023-02/25286deb-ff39-4153-b084-eb5319a6f780.png", bg: "#1565C0" },
  "씨제이올리브영": { logo: "https://static.ustockplus.com/admin/2023-03/fc909dc9-9e11-48cc-aa78-4b3f1ac94a28.png", bg: "#E8344E" },
  "우아한형제들": { logo: "https://static.ustockplus.com/logo/company/635.png", bg: "#333333" },
  "여기어때컴퍼니": { logo: "https://static.ustockplus.com/logo/company/84.png", bg: "#F37321" },
  "비나우": { logo: "https://static.ustockplus.com/admin/2026-02/21e49c3d-1db8-47ec-87c8-4ce706042ffd.png", bg: "#333333" },
  "이피캠텍": { logo: "https://static.ustockplus.com/logo/company/63941.png", bg: "#1976D2" },
  "럭스로보": { logo: "https://static.ustockplus.com/logo/company/68870.png", bg: "#333333" },
  "아데나소프트웨어": { logo: "https://static.ustockplus.com/logo/company/585.png", bg: "#1976D2" },
  "토스페이먼츠": { logo: "https://static.ustockplus.com/logo/company/65969.png", bg: "#3182f6" },
  "클레버": { logo: "https://static.ustockplus.com/admin/2023-02/3f9ce161-1e49-409e-a91d-abd090889f4b.png", bg: "#333333" },
  "알바이오": { logo: "https://static.ustockplus.com/admin/2023-02/b14b6185-e4a5-4857-a639-1974c74d22e1.png", bg: "#E8344E" },
  "솔젠트": { logo: "https://static.ustockplus.com/admin/2023-01/9d6b894c-47c8-45b1-8e25-9b379607b31c.png", bg: "#1976D2" },
  "아이월드제약": { logo: "https://static.ustockplus.com/admin/2023-10/1dd57c7a-f1ae-4b65-997d-14b4c8372a46.png", bg: "#43A047" },
  "엔지더블유": { logo: "https://static.ustockplus.com/logo/company/616.png", bg: "#333333" },
  "꽃피는아침마을": { logo: "https://static.ustockplus.com/admin/2023-03/119c3b8a-5413-415d-9bd3-a33a8ed82ecd.png", bg: "#43A047" },
  "이씨스": { logo: "https://static.ustockplus.com/admin/2023-02/f07cd183-39e2-463b-84f9-1ca566459d42.png", bg: "#1976D2" },
  "나이스엘엠에스": { logo: "https://static.ustockplus.com/logo/company/602.png", bg: "#333333" },
  "엑스엘게임즈": { logo: "https://static.ustockplus.com/logo/stock/225630.png", bg: "#333333" },
  "플랜텍": { logo: "https://static.ustockplus.com/admin/2023-02/937f9e69-5d3a-4e89-9138-32445c61e7ba.png", bg: "#1976D2" },
  "로우카본": { logo: "https://static.ustockplus.com/admin/2023-05/8be8db82-0cc6-42e7-b9fe-45243d236c78.png", bg: "#2E7D32" },
  "그래핀스퀘어": { logo: "https://static.ustockplus.com/admin/2023-01/0686ffea-0f89-4f83-8bbc-b01e52ec04c7.png", bg: "#333333" },
  "애자일소다": { logo: "https://static.ustockplus.com/admin/2023-02/8a839a3b-2c7f-46ca-8cf3-2aec138d2233.png", bg: "#1976D2" },
  "오톰": { logo: "https://static.ustockplus.com/admin/2023-01/33d52156-7bff-43d1-896e-a9dd3b59d858.png", bg: "#333333" },
  "마이리얼트립": { logo: "https://static.ustockplus.com/admin/2023-02/731a0e1d-48bf-46ef-a699-d10cbe743a9a.png", bg: "#3182f6" },
  "덕양에너젠": { logo: "https://static.ustockplus.com/admin/2026-01/db876834-45cf-41f3-b5be-8ed8c4658da0.png", bg: "#1565C0" },
};

const STOCK_CODE_MAP: Record<string, string> = {
  "카카오뱅크": "323410",
  "삼성전자": "005930",
  "SK하이닉스": "000660",
  "LG에너지솔루션": "373220",
  "삼성바이오로직스": "207940",
  "현대자동차": "005380",
  "기아": "000270",
  "셀트리온": "068270",
  "KB금융": "105560",
  "POSCO홀딩스": "005490",
  "신한지주": "055550",
  "삼성SDI": "006400",
  "LG화학": "051910",
  "NAVER": "035420",
  "카카오": "035720",
  "하나금융지주": "086790",
  "현대모비스": "012330",
  "삼성물산": "028260",
  "SK이노베이션": "096770",
  "LG전자": "066570",
  "삼성생명": "032830",
  "한국전력": "015760",
  "SK텔레콤": "017670",
  "KT": "030200",
  "우리금융지주": "316140",
  "삼성화재": "000810",
  "포스코인터내셔널": "047050",
  "SK": "034730",
  "한화에어로스페이스": "012450",
  "대한항공": "003490",
  "HMM": "011200",
  "LG": "003550",
  "고려아연": "010130",
  "삼성전기": "009150",
  "한화솔루션": "009830",
  "한국타이어앤테크놀로지": "161390",
  "CJ제일제당": "097950",
  "S-Oil": "010950",
  "두산에너빌리티": "034020",
  "롯데케미칼": "011170",
  "엔씨소프트": "036570",
  "크래프톤": "259960",
  "삼성에스디에스": "018260",
  "NH투자증권": "005940",
  "미래에셋증권": "006800",
  "한국투자증권": "071050",
  "키움증권": "039490",
  "대신증권": "003540",
  "SK바이오팜": "326030",
  "SK바이오사이언스": "302440",
  "에코프로비엠": "247540",
  "에코프로": "086520",
  "포스코퓨처엠": "003670",
  "알테오젠": "196170",
  "한미약품": "128940",
  "유한양행": "000100",
  "녹십자": "006280",
  "JYP엔터": "035900",
  "HYBE": "352820",
  "하이브": "352820",
  "SM엔터": "041510",
  "넷마블": "251270",
  "펄어비스": "263750",
  "컴투스": "078340",
  "CJ ENM": "035760",
  "스튜디오드래곤": "253450",
  "카카오게임즈": "293490",
  "위메이드": "112040",
  "SK스퀘어": "402340",
  "LG이노텍": "011070",
  "두산밥캣": "241560",
  "한화오션": "042660",
  "HD현대": "267250",
  "HD한국조선해양": "009540",
  "HD현대중공업": "329180",
  "현대건설": "000720",
  "GS건설": "006360",
  "대우건설": "047040",
  "DL이앤씨": "375500",
  "한전KPS": "051600",
  "한국가스공사": "036460",
  "에스원": "012750",
  "CJ대한통운": "000120",
  "아모레퍼시픽": "090430",
  "LG생활건강": "051900",
  "호텔신라": "008770",
  "F&F": "383220",
  "한섬": "020000",
  "쏘카": "403550",
  "한화": "000880",
  "한화시스템": "272210",
  "LIG넥스원": "079550",
  "현대로템": "064350",
  "풍산": "103140",
  "LG디스플레이": "034220",
  "한국항공우주": "047810",
  "넥슨게임즈": "225570",
  "서울보증보험": "004370",
  "에이피알": "278470",
  "레인보우로보틱스": "277810",
  "두산로보틱스": "454910",
  "메디톡스": "086900",
  "휴젤": "145020",
  "파마리서치": "214450",
  "제넥신": "095700",
  "씨젠": "096530",
  "에이비엘바이오": "298380",
  "진원생명과학": "011000",
  "코리아센터": "290510",
  "브레인즈컴퍼니": "099390",
  "한패스": "408470",
  "아이엠바이오로직스": "493280",
};

const BRAND_COLORS: Record<string, string> = {
  "카카오": "#FEE500",
  "삼성": "#1428A0",
  "SK": "#E8344E",
  "LG": "#A50034",
  "현대": "#003DA5",
  "한화": "#F37321",
  "HD": "#003DA5",
  "POSCO": "#004B93",
  "포스코": "#004B93",
  "CJ": "#E8344E",
  "롯데": "#E8344E",
  "GS": "#F37321",
  "DL": "#003DA5",
  "NH": "#003DA5",
  "KB": "#FFBC00",
  "두산": "#1976D2",
};

function getBrandColor(name: string): string {
  for (const [brand, color] of Object.entries(BRAND_COLORS)) {
    if (name.startsWith(brand) || name.includes(brand)) return color;
  }
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ["#E8344E", "#1976D2", "#43A047", "#F37321", "#003DA5", "#333333", "#6B4CE6", "#00B4D8", "#5F0080"];
  return colors[Math.abs(hash) % colors.length];
}

function getLogoUrl(name: string): string | null {
  const entry = STOCK_LOGOS[name];
  if (entry?.logo) return entry.logo;

  if (dynamicLogos[name]) return dynamicLogos[name];

  const code = STOCK_CODE_MAP[name];
  if (code) {
    return `https://file.alphasquare.co.kr/media/images/stock_logo/kr/${code}.png`;
  }

  return null;
}

export function StockIcon({ name, logoUrl: providedLogoUrl, size = 32 }: { name: string; logoUrl?: string | null; size?: number }) {
  const [imgError, setImgError] = useState(false);
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    setImgError(false);
    fetchDynamicLogos();
    if (!providedLogoUrl && !STOCK_LOGOS[name]?.logo && !dynamicLogos[name]) {
      const timer = setTimeout(() => forceUpdate(n => n + 1), 1500);
      return () => clearTimeout(timer);
    }
  }, [name, providedLogoUrl]);
  const logoUrl = providedLogoUrl || getLogoUrl(name);
  const bg = STOCK_LOGOS[name]?.bg || getBrandColor(name);
  const char = name.charAt(0);
  const fontSize = size <= 24 ? 10 : size <= 32 ? 13 : 14;
  const containLogo = name === "브릴스";

  if (logoUrl && !imgError) {
    return (
      <img
        src={logoUrl}
        alt={`${name} 로고`}
        className={`rounded-full shrink-0 ${containLogo ? "object-contain bg-white" : "object-cover"}`}
        style={{ width: size, height: size }}
        onError={() => setImgError(true)}
        data-testid={`icon-stock-${name}`}
        referrerPolicy="no-referrer"
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, backgroundColor: bg, fontSize }}
      data-testid={`icon-stock-${name}`}
    >
      {char}
    </div>
  );
}

export function getStockColor(name: string): string {
  return STOCK_LOGOS[name]?.bg || getBrandColor(name);
}
