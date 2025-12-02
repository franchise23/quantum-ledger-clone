const API_BASE =
  window.API_BASE ||
  "https://quantum-ledger-org.onrender.com"; // backend base URL (prod); override by setting window.API_BASE before script loads
const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,tether,solana&order=market_cap_desc&per_page=4&page=1&sparkline=false";

// Your demo portfolio (amounts you hold)
const DEMO_HOLDINGS = [
  { id: "bitcoin", symbol: "BTC", label: "Bitcoin (BTC)", amount: 0.35 },
  { id: "ethereum", symbol: "ETH", label: "Ethereum (ETH)", amount: 4.8 },
  { id: "tether", symbol: "USDT", label: "Tether (USDT)", amount: 3000 },
  { id: "solana", symbol: "SOL", label: "Solana (SOL)", amount: 45 },
];

function formatCurrency(value) {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getToken() {
  try {
    return localStorage.getItem("qlnToken");
  } catch (err) {
    console.error("Error reading token", err);
    return null;
  }
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem("qlnCurrentUser");
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error("Error reading stored user", err);
    return null;
  }
}

function clearAuthData() {
  localStorage.removeItem("qlnToken");
  localStorage.removeItem("qlnCurrentUser");
}

// Call backend to verify token and get current user
async function fetchCurrentUser() {
  const token = getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE}/api/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return data.user || null;
  } catch (err) {
    console.error("Error calling /api/me:", err);
    return null;
  }
}

// Get live market data from CoinGecko and merge with DEMO_HOLDINGS
async function loadPortfolioData() {
  try {
    const res = await fetch(COINGECKO_URL);
    if (!res.ok) {
      throw new Error("Failed to fetch market data");
    }

    const marketData = await res.json(); // array of coins
    const byId = {};
    marketData.forEach((coin) => {
      byId[coin.id] = coin;
    });

    let totalValue = 0;
    let topAsset = null;

    const enrichedHoldings = DEMO_HOLDINGS.map((h) => {
      const coin = byId[h.id];
      let price = 0;
      let change24h = 0;

      if (coin) {
        price = coin.current_price || 0;
        change24h = coin.price_change_percentage_24h || 0;
      }

      const value = price * h.amount;
      totalValue += value;

      const enriched = {
        ...h,
        price,
        value,
        change24h,
      };

      if (!topAsset || value > topAsset.value) {
        topAsset = enriched;
      }

      return enriched;
    });

    return {
      holdings: enrichedHoldings,
      totalValue,
      topAsset,
      lastUpdated: new Date(),
    };
  } catch (err) {
    console.error("Error loading portfolio data:", err);

    // Fallback: static approximations if API fails
    const fallbackHoldings = [
      { ...DEMO_HOLDINGS[0], price: 26000, value: 26000 * DEMO_HOLDINGS[0].amount, change24h: 3.2 },
      { ...DEMO_HOLDINGS[1], price: 1800, value: 1800 * DEMO_HOLDINGS[1].amount, change24h: 1.4 },
      { ...DEMO_HOLDINGS[2], price: 1, value: DEMO_HOLDINGS[2].amount * 1, change24h: 0.0 },
      { ...DEMO_HOLDINGS[3], price: 150, value: 150 * DEMO_HOLDINGS[3].amount, change24h: 5.1 },
    ];

    let totalValue = 0;
    let topAsset = fallbackHoldings[0];

    fallbackHoldings.forEach((h) => {
      totalValue += h.value;
      if (!topAsset || h.value > topAsset.value) {
        topAsset = h;
      }
    });

    return {
      holdings: fallbackHoldings,
      totalValue,
      topAsset,
      lastUpdated: new Date(),
    };
  }
}

// Fill in dashboard UI with user + portfolio data
function populateDashboard(user, portfolio) {
  const nameEl = document.getElementById("dash-username");
  const totalBalanceEl = document.getElementById("dash-total-balance");
  const holdingsGrid = document.getElementById("dash-asset-grid");
  const lastUpdatedEl = document.getElementById("dash-last-updated");

  if (nameEl) {
    nameEl.textContent = user.name || user.email;
  }

  if (lastUpdatedEl && portfolio.lastUpdated) {
    const t = portfolio.lastUpdated;
    const hh = String(t.getHours()).padStart(2, "0");
    const mm = String(t.getMinutes()).padStart(2, "0");
    const ss = String(t.getSeconds()).padStart(2, "0");
    lastUpdatedEl.textContent = `Last updated: ${hh}:${mm}:${ss}`;
  }

  if (totalBalanceEl) {
    totalBalanceEl.textContent = formatCurrency(portfolio.totalValue || 0);
  }

  if (holdingsGrid) {
    holdingsGrid.innerHTML = "";
    const colorMap = {
      BTC: "#f7931a",
      ETH: "#6b7280",
      USDT: "#22c55e",
      SOL: "#14b8a6",
    };

    portfolio.holdings.forEach((h) => {
      const card = document.createElement("div");
      card.className = "dash-asset-card";

      const changeClass = h.change24h >= 0 ? "pos" : "neg";
      const changeLabel = `${h.change24h.toFixed(2)}%`;
      const bg = colorMap[h.symbol?.toUpperCase()] || "#0ea5e9";

      card.innerHTML = `
        <div class="dash-asset-top">
          <div class="dash-asset-name">
            <div class="dash-asset-icon" style="background:${bg}">${h.symbol
              .toUpperCase()
              .slice(0, 3)}</div>
            <div>
              <div>${h.label}</div>
              <div class="dash-asset-value">${h.amount} ${h.symbol.toUpperCase()}</div>
            </div>
          </div>
          <div class="dash-asset-price">${formatCurrency(h.price || 0)}</div>
        </div>
        <div class="dash-asset-row">
          <div class="dash-asset-value">=${formatCurrency(h.value || 0)}</div>
          <div class="dash-asset-change ${changeClass}">${changeLabel}</div>
        </div>
      `;

      holdingsGrid.appendChild(card);
    });
  };
}

// Logout handler
function setupLogout() {
  const btn = document.getElementById("dash-logout");
  if (!btn) return;

  btn.addEventListener("click", () => {
    clearAuthData();
    window.location.href = "index.html";
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const token = getToken();
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  // 1. Validate user with backend
  let user = await fetchCurrentUser();

  if (!user) {
    const storedUser = getStoredUser();
    if (storedUser) {
      user = storedUser;
    } else {
      clearAuthData();
      window.location.href = "index.html";
      return;
    }
  }

  // 2. Load live portfolio data
  const portfolio = await loadPortfolioData();

  // 3. Populate UI
  populateDashboard(user, portfolio);
  setupLogout();
});

