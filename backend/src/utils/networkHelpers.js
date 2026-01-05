// utils/networkHelpers.js
export function isRouterIP(ip, hostname = "", vendor = "") {
  if (!ip) return false;

  const lowerHost = hostname.toLowerCase();
  const lowerVendor = vendor.toLowerCase();

  // 🧩 Common static router IPs
  const knownRouterIPs = [
    "192.168.0.1", "192.168.1.1", "192.168.1.254",
    "10.0.0.1", "10.1.1.1", "172.16.0.1",
  ];

  // 🧠 Hotspot / gateway patterns (common in mobile + shared networks)
  const routerPatterns = [
    ".0.1", ".1.1", ".254", ".1.254", ".0.254", ".1",
    ".43.1",  // Android tether
    ".137.1", // Windows hotspot
    ".2.1",   // macOS Internet Sharing
    ".10.1",  // iPhone hotspot
    ".248.1", // Jio / Airtel / VI routers
    ".225.1", // Jio 4G routers
    ".42.129" // MediaTek chipsets
  ];

  // 1️⃣ Direct match
  if (knownRouterIPs.includes(ip)) return true;

  // 2️⃣ Pattern match
  if (routerPatterns.some(p => ip.endsWith(p))) return true;

  // 3️⃣ Vendor / hostname hint match
  if (/(router|gateway|modem|fiber|broadband|dlink|tplink|netgear|asus|wifi)/i.test(lowerHost)) return true;
  if (/(router|gateway|modem|fiber|broadband|access point)/i.test(lowerVendor)) return true;

  return false;
}

/**
 * Extract all potential IPv4 addresses from system data payload.
 */
export function extractIPs(data) {
    if (!data) return [];
    const ips = [];
  
    if (data.ip) ips.push(data.ip);
    if (data.address) ips.push(data.address);
  
    if (Array.isArray(data.wlan_info)) {
      data.wlan_info.forEach((w) => w?.address && ips.push(w.address));
    }
    if (Array.isArray(data.wlan_ip)) {
      data.wlan_ip.forEach((w) => w?.address && ips.push(w.address));
    }
  
    // Filter out obvious noise
    return [...new Set(ips)].filter(ip =>
      ip &&
      typeof ip === 'string' &&
      !ip.startsWith("127.") &&
      !ip.startsWith("169.254.") &&
      !ip.includes(":") // Skip IPv6 for now if only IPv4 is requested
    );
}

/**
 * Pick the "best" routable LAN IP from a list of candidates.
 */
export function resolveBestIP(candidates, fallback) {
    if (!Array.isArray(candidates) || candidates.length === 0) return fallback;

    // Prioritize RFC1918 Private ranges
    const routableMatch = candidates.find(ip =>
        ip.startsWith("192.168.") || 
        ip.startsWith("10.") || 
        ip.startsWith("172.")
    );

    if (routableMatch) return routableMatch;
    
    // If no classic LAN match, but we have ANY valid candidate that isn't loopback/apipa
    return candidates[0] || fallback;
}
