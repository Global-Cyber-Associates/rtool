#!/usr/bin/env python3
"""
Hybrid fast scanner with fast disappearance detection.
"""

import ipaddress
import json
import time
import socket
import subprocess
import random
from concurrent.futures import ThreadPoolExecutor, as_completed
import netifaces

# ---- CONFIG ----
UDP_PORTS = [5353, 1900, 137]
TCP_PORTS = [80, 443, 53, 135, 139, 445]
TCP_TIMEOUT = 0.15
UDP_SEND_TIMEOUT = 0.01
THREADS = 200
INITIAL_FULL_SCAN_INTERVAL = 1.0
FAST_CYCLE_DELAY = 0.6
CYCLE_INTERVAL = 3.0
RANDOM_SAMPLE_PER_CYCLE = 30
NEIGHBOR_RANGE = 2

# how fast a device disappears
DISAPPEAR_THRESHOLD = 2   # 2 cycles → ~6 seconds

# store stale counters
stale_counts = {}
# ----------------


def detect_network():
    gws = netifaces.gateways()
    if netifaces.AF_INET in gws:
        try:
            entry = gws[netifaces.AF_INET][0]
            iface = entry[1]
            addrs = netifaces.ifaddresses(iface).get(netifaces.AF_INET, [])
            for a in addrs:
                ip = a.get("addr")
                nm = a.get("netmask")
                if ip and nm:
                    return iface, ip, nm, str(ipaddress.IPv4Network(f"{ip}/{nm}", False))
        except:
            pass

    for iface in netifaces.interfaces():
        addrs = netifaces.ifaddresses(iface).get(netifaces.AF_INET, [])
        for a in addrs:
            ip = a.get("addr")
            nm = a.get("netmask")
            if ip and nm:
                return iface, ip, nm, str(ipaddress.IPv4Network(f"{ip}/{nm}", False))

    return "lo", "127.0.0.1", "255.255.255.255", "127.0.0.1/32"


########################### PROBES #################################

def udp_wake_ips(ips):
    def send_to(ip):
        try:
            for port in UDP_PORTS:
                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                s.settimeout(UDP_SEND_TIMEOUT)
                try:
                    s.sendto(b"", (ip, port))
                except:
                    pass
                try:
                    s.close()
                except:
                    pass
        except:
            pass

    with ThreadPoolExecutor(max_workers=THREADS) as e:
        e.map(send_to, ips)


def tcp_probe(ip):
    for port in TCP_PORTS:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(TCP_TIMEOUT)
        try:
            if s.connect_ex((ip, port)) == 0:
                s.close()
                return True
        except:
            pass
        finally:
            try:
                s.close()
            except:
                pass
    return False


def read_arp_table(cidr):
    try:
        output = subprocess.check_output("arp -a", shell=True, text=True)
    except:
        return set()

    net = ipaddress.ip_network(cidr, False)
    result = set()

    for line in output.splitlines():
        line = line.strip()
        if "." not in line or "-" not in line:
            continue

        parts = line.split()
        if not parts:
            continue

        ip = parts[0].strip()
        try:
            ip_addr = ipaddress.IPv4Address(ip)
            if ip_addr in net:
                if ip_addr == net.broadcast_address: continue
                if ip_addr.is_multicast or ip_addr.is_loopback: continue
                result.add(str(ip_addr))
        except:
            continue

    return result


def neighbors_of(ip_str, cidr, rng=NEIGHBOR_RANGE):
    net = ipaddress.ip_network(cidr, False)
    try:
        ip = ipaddress.IPv4Address(ip_str)
    except:
        return []
    base = int(ip)
    out = []
    for d in range(-rng, rng + 1):
        if d == 0: continue
        cand = ipaddress.IPv4Address(base + d)
        if cand in net:
            out.append(str(cand))
    return out


########################### SCANS #################################

def initial_full_scan(cidr, local_ip):
    net = ipaddress.ip_network(cidr, False)
    ips = [str(ip) for ip in net.hosts()]

    udp_wake_ips(ips)
    time.sleep(INITIAL_FULL_SCAN_INTERVAL)

    arp_alive = read_arp_table(cidr)

    alive_by_tcp = set()
    with ThreadPoolExecutor(max_workers=THREADS) as ex:
        futures = {ex.submit(tcp_probe, ip): ip for ip in ips}
        for fut in as_completed(futures):
            if fut.result():
                alive_by_tcp.add(futures[fut])

    combined = set(arp_alive) | alive_by_tcp
    combined.add(local_ip)
    return combined


def incremental_scan(previous_alive, cidr, local_ip):
    net = ipaddress.ip_network(cidr, False)
    all_hosts = [str(ip) for ip in net.hosts()]

    target = set(previous_alive)

    for ip in list(previous_alive):
        target.update(neighbors_of(ip, cidr))

    remaining = [h for h in all_hosts if h not in target]
    if remaining:
        target.update(random.sample(remaining, min(RANDOM_SAMPLE_PER_CYCLE, len(remaining))))

    udp_wake_ips(list(target))
    time.sleep(FAST_CYCLE_DELAY)

    arp_alive = read_arp_table(cidr)

    alive_by_tcp = set()
    with ThreadPoolExecutor(max_workers=THREADS) as ex:
        futures = {ex.submit(tcp_probe, ip): ip for ip in target}
        for fut in as_completed(futures):
            if fut.result():
                alive_by_tcp.add(futures[fut])

    combined = set(arp_alive) | alive_by_tcp
    combined.add(local_ip)
    return combined


########################### MAIN #################################

def main():
    _, local_ip, _, cidr = detect_network()
    print(json.dumps({"scanner": "started", "cidr": cidr}), flush=True)

    previous_alive = initial_full_scan(cidr, local_ip)
    for ip in previous_alive:
        stale_counts[ip] = 0

    print(json.dumps([{"ip": ip} for ip in sorted(previous_alive)]), flush=True)

    while True:
        start = time.time()
        alive = incremental_scan(previous_alive, cidr, local_ip)

        # --------- FAST DISAPPEAR DETECTION ----------
        updated_alive = set()

        for ip in alive:
            stale_counts[ip] = 0
            updated_alive.add(ip)

        for ip in previous_alive:
            if ip not in alive:
                stale_counts[ip] += 1
                if stale_counts[ip] < DISAPPEAR_THRESHOLD:
                    updated_alive.add(ip)  # keep for 1–2 more cycles (grace)
                # else → fully remove it fast

        previous_alive = updated_alive
        # ---------------------------------------------

        print(json.dumps([{"ip": ip} for ip in sorted(updated_alive)]), flush=True)

        elapsed = time.time() - start
        time.sleep(max(0, CYCLE_INTERVAL - elapsed))


if __name__ == "__main__":
    main()
