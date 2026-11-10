export const EXAMPLE_BASIC_LC_YAML = `mixed-port: 7890
allow-lan: false
bind-address: '*'
mode: rule
log-level: info
external-controller: '127.0.0.1:9090'
unified-delay: true
tcp-concurrent: true
ipv6: true
dns:
  enable: true
  ipv6: true
  default-nameserver: [223.5.5.5, 119.29.29.29, 114.114.114.114]
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  use-hosts: true
  respect-rules: true
  proxy-server-nameserver: [223.5.5.5, 119.29.29.29, 114.114.114.114]
  nameserver: [223.5.5.5, 119.29.29.29, 114.114.114.114]
  fallback: [1.1.1.1, 8.8.8.8]
proxies:
  - { name: 'JP-Line-1-0.1x', server: hided8.186.example.com, port: 443, udp: true, skip-cert-verify: true, sni: www.bing.com, type: hysteria2, password: 3e3-hided-860, fingerprint: 1234567890abcd1234567890 }
  - { name: 'JP-Line-3-Hop-0.1x', server: hided9.52.example.com, port: 61000, ports: 61000-62000, mport: 61000-62000, udp: true, skip-cert-verify: true, sni: www.bing.com, type: hysteria2, password: 3e3-hided-860, fingerprint: 1234567890abcd1234567890 }
  - { name: 'US-Phoenix-Hop-0.1x', server: hided242.180.example.com, port: 61000, ports: 61000-62000, mport: 61000-62000, udp: true, skip-cert-verify: true, sni: www.bing.com, type: hysteria2, password: 3e3-hided-860, fingerprint: 1234567890abcd1234567890 }
  - { name: 'SG-Line-Hop', server: hided06.140.example.com, port: 50000, ports: 50000-55000, mport: 50000-55000, udp: true, skip-cert-verify: true, sni: www.bing.com, type: hysteria2, password: 3e3-hided-860, fingerprint: 1234567890abcd1234567890 }
  - { name: 'AWS-JP-1', type: vless, server: hidedca.e048.f1-fef1f.yfjcs.com, port: 443, uuid: 3e300000-0000-4000-8000-000000000860, udp: true, tls: true, skip-cert-verify: false, flow: xtls-rprx-vision, client-fingerprint: chrome, servername: osxapps.itunes.apple.com, reality-opts: { public-key: hided_PT-BjrGR_EtnI, short-id: 1b95f5d0 } }
  - { name: 'AWS-JP-2', type: vless, server: hidedca.e048.f2-fef1f.yfjcs.com, port: 443, uuid: 3e300000-0000-4000-8000-000000000860, udp: true, tls: true, skip-cert-verify: false, flow: xtls-rprx-vision, client-fingerprint: chrome, servername: osxapps.itunes.apple.com, reality-opts: { public-key: hided_cCFlhKLcOkaVE, short-id: 67e0e4a0 } }
  - { name: 'TW-Taipei-1', type: vless, server: hidedba.e048.f65-fef1f.yfjcs.com, port: 443, uuid: 3e300000-0000-4000-8000-000000000860, udp: true, tls: true, skip-cert-verify: false, flow: xtls-rprx-vision, client-fingerprint: ios, servername: cdn-dynmedia-1.microsoft.com, reality-opts: { public-key: hided_0Ay6MaoP3l6Hw, short-id: be823fa3 } }
  - { name: 'US-Phoenix-1-0.1x', type: vless, server: hided242.179.example.com, port: 443, uuid: 3e300000-0000-4000-8000-000000000860, udp: true, tls: true, skip-cert-verify: false, flow: xtls-rprx-vision, client-fingerprint: ios, servername: tv.apple.com, reality-opts: { public-key: hided_sIu4WeffywLBY, short-id: 78f5a5a5 } }
  - { name: 'US-AI-Unlock-0.1x', type: vless, server: hided101.75.example.com, port: 443, uuid: 3e300000-0000-4000-8000-000000000860, udp: true, tls: true, skip-cert-verify: false, flow: xtls-rprx-vision, client-fingerprint: ios, servername: cdn-dynmedia-1.microsoft.com, reality-opts: { public-key: hided_96O1fEFocOK0w, short-id: 8004932d } }
  - { name: 'HK-HKBN-WS', type: vless, server: hided.sbs, port: 443, uuid: 3e300000-0000-4000-8000-000000000860, udp: true, tls: true, skip-cert-verify: false, flow: '', client-fingerprint: safari, servername: hided36.xyz, network: ws, ws-opts: { path: /yfjc/hk, headers: { Host: hided36.xyz } } }
  - { name: 'US-WS-1-0.1x', type: vless, server: hided.sbs, port: 443, uuid: 3e300000-0000-4000-8000-000000000860, udp: true, tls: true, skip-cert-verify: false, flow: '', client-fingerprint: safari, servername: hided26.xyz, network: ws, ws-opts: { path: /yfjc/us1, headers: { Host: hided26.xyz } } }
`;

export const EXAMPLE_COMPLEX_XF_YAML = `mixed-port: 7890
allow-lan: true
bind-address: '*'
mode: rule
log-level: info
external-controller: '127.0.0.1:9090'
unified-delay: true
sniffer:
  enable: true
  sniff: { TLS: { ports: [443], override-destination: true }, HTTP: { ports: [80], override-destination: true } }
dns:
  enable: true
  ipv6: false
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  default-nameserver: [223.5.5.5, 119.29.29.29, 114.114.114.114]
  proxy-server-nameserver: ['https://cn.ali-oss.cn:44443/dns-query/6dafe708-d9d6-48cc-a768-e6ed3018a9ec', 'https://hk.ali-oss.cn:44443/dns-query/6dafe708-d9d6-48cc-a768-e6ed3018a9ec']
  nameserver: [223.5.5.5, 119.29.29.29, 114.114.114.114]
proxies:
  - { name: 'HK-01 [S]', type: vless, server: 97e6waht.cnrcz.cn, port: 10001, uuid: 5e800000-0000-4000-8000-00000000c3a6, udp: true, flow: xtls-rprx-vision, tls: true, skip-cert-verify: false, client-fingerprint: chrome, servername: www.lamer.com.hk, reality-opts: { public-key: hided_s_jNNhtC6O2EI, short-id: 11f2f1fe } }
  - { name: 'HK-02 [S]', type: vless, server: 97e6waht.cnrcz.cn, port: 10002, uuid: 5e800000-0000-4000-8000-00000000c3a6, udp: true, flow: xtls-rprx-vision, tls: true, skip-cert-verify: false, client-fingerprint: chrome, servername: www.lamer.com.hk, reality-opts: { public-key: hided_pzZEu7a8L0S0o, short-id: a230d2fe } }
  - { name: 'SG-01 [S]', type: vless, server: a210waht.csnau.cn, port: 13001, uuid: 5e800000-0000-4000-8000-00000000c3a6, udp: true, flow: xtls-rprx-vision, tls: true, skip-cert-verify: false, client-fingerprint: chrome, servername: www.lamer.com.sg, reality-opts: { public-key: hided_1HduOsu3ivBkg, short-id: 64af2805 } }
  - { name: 'JP-01 [S]', type: vless, server: 541awaht.cnrcz.cn, port: 14001, uuid: 5e800000-0000-4000-8000-00000000c3a6, udp: true, flow: xtls-rprx-vision, tls: true, skip-cert-verify: false, client-fingerprint: chrome, servername: www.apple.com.cn, reality-opts: { public-key: hided_HvTrKlRNymGTU, short-id: e4ada79a } }
  - { name: 'US-01 [S]', type: vless, server: 5405waht.csnau.cn, port: 15001, uuid: 5e800000-0000-4000-8000-00000000c3a6, udp: true, flow: xtls-rprx-vision, tls: true, skip-cert-verify: false, client-fingerprint: chrome, servername: download-porter.hoyoverse.com, reality-opts: { public-key: hided_z1_UUtIlkkElc, short-id: 38a7ffe3 } }
  - { name: 'CA-01 [S]', type: vless, server: 5405waht.csnau.cn, port: 15005, uuid: 5e800000-0000-4000-8000-00000000c3a6, udp: true, flow: xtls-rprx-vision, tls: true, skip-cert-verify: false, client-fingerprint: chrome, servername: download-porter.hoyoverse.com, reality-opts: { public-key: hided_3FRuAT15Bhkzs, short-id: '09561058' } }
`;

export const EXAMPLE_YY_YAML = `proxies:
  - { name: 'HK-A | BGP', type: ss, server: hk-a.yy-bgp.example.com, port: 8388, cipher: 2022-blake3-aes-128-gcm, password: 'hided-yy-ss-key-0001' }
  - { name: 'SG-1 | BGP', type: ss, server: sg-1.yy-bgp.example.com, port: 8388, cipher: aes-256-gcm, password: 'hided-yy-ss-key-0002' }
  - { name: 'JP-1 | BGP', type: vmess, server: jp-1.yy-bgp.example.com, port: 443, uuid: 7a100000-0000-4000-8000-000000000101, alterId: 0, cipher: auto, tls: true, skip-cert-verify: false, servername: jp-1.yy-bgp.example.com, network: ws, ws-opts: { path: /vmess-jp, headers: { Host: jp-1.yy-bgp.example.com } } }
  - { name: 'US-1 | BGP', type: vmess, server: us-1.yy-bgp.example.com, port: 443, uuid: 7a100000-0000-4000-8000-000000000102, alterId: 0, cipher: auto, tls: true, skip-cert-verify: false, servername: us-1.yy-bgp.example.com, network: ws, ws-opts: { path: /vmess-us, headers: { Host: us-1.yy-bgp.example.com } } }
  - { name: 'UK-London | BGP', type: trojan, server: uk-1.yy-bgp.example.com, port: 443, password: 'hided-yy-trojan-pass', sni: uk-1.yy-bgp.example.com, skip-cert-verify: false }
`;

export const EXAMPLE_LT_YAML = `proxies:
  - { name: '[Exp] HK-01', type: vless, server: hk01.lt-exp.example.com, port: 443, uuid: 9b200000-0000-4000-8000-000000000201, tls: true, skip-cert-verify: false, servername: hk01.lt-exp.example.com, client-fingerprint: chrome, ech-opts: { enable: true, query-server-name: cloudflare-ech.com } }
  - { name: '[Exp] SG-01', type: vless, server: sg01.lt-exp.example.com, port: 443, uuid: 9b200000-0000-4000-8000-000000000202, tls: true, skip-cert-verify: false, servername: sg01.lt-exp.example.com, client-fingerprint: chrome }
  - { name: '[Exp] JP-01', type: vless, server: jp01.lt-exp.example.com, port: 443, uuid: 9b200000-0000-4000-8000-000000000203, tls: true, skip-cert-verify: false, servername: jp01.lt-exp.example.com, client-fingerprint: chrome }
  - { name: '[Adv] DE-Frankfurt', type: vless, server: de01.lt-exp.example.com, port: 443, uuid: 9b200000-0000-4000-8000-000000000204, tls: true, skip-cert-verify: false, servername: de01.lt-exp.example.com, client-fingerprint: chrome }
`;

export const EXAMPLE_SE_YAML = `proxies:
  - { name: 'HK | ANYTLS | GA', type: anytls, server: hk-anytls.se-ga.example.com, port: 443, password: 'hided-se-anytls-pass', sni: hk-anytls.se-ga.example.com, skip-cert-verify: false, client-fingerprint: chrome, idle-session-check-interval: 30, idle-session-timeout: 30, min-idle-session: 4 }
  - { name: 'JP | ANYTLS | GA', type: anytls, server: jp-anytls.se-ga.example.com, port: 443, password: 'hided-se-anytls-pass', sni: jp-anytls.se-ga.example.com, skip-cert-verify: false, client-fingerprint: chrome, idle-session-check-interval: 30, idle-session-timeout: 30, min-idle-session: 4 }
  - { name: 'US | ANYTLS | GA', type: anytls, server: us-anytls.se-ga.example.com, port: 443, password: 'hided-se-anytls-pass', sni: us-anytls.se-ga.example.com, skip-cert-verify: false, client-fingerprint: chrome, idle-session-check-interval: 30, idle-session-timeout: 30, min-idle-session: 4 }
  - { name: 'HK | IEPL-01', type: ss, server: hk-iepl.se-ga.example.com, port: 18388, cipher: aes-128-gcm, password: 'hided-se-iepl-pass' }
`;
