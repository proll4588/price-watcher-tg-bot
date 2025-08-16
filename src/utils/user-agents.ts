export const userAgents = [
  // Chrome
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",

  // Firefox
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",

  // Safari
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",

  // Edge
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",

  // Mobile
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 14; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
];

export function getRandomUserAgent(): string {
  const index = Math.floor(Math.random() * userAgents.length);
  return userAgents[index]!;
}

export function getMobileUserAgent(): string {
  const mobileAgents = userAgents.filter(
    agent => agent.includes("iPhone") || agent.includes("Android")
  );
  if (mobileAgents.length === 0) return userAgents[0]!;
  const index = Math.floor(Math.random() * mobileAgents.length);
  return mobileAgents[index]!;
}

export function getDesktopUserAgent(): string {
  const desktopAgents = userAgents.filter(
    agent => !agent.includes("iPhone") && !agent.includes("Android")
  );
  if (desktopAgents.length === 0) return userAgents[0]!;
  const index = Math.floor(Math.random() * desktopAgents.length);
  return desktopAgents[index]!;
}
