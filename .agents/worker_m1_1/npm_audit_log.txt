# npm audit report

@remix-run/router  <=1.23.1
Severity: high
React Router vulnerable to XSS via Open Redirects - https://github.com/advisories/GHSA-2w69-qvjg-hvjx
fix available via `npm audit fix`
node_modules/@remix-run/router
  react-router  6.4.0-pre.0 - 6.30.3
  Depends on vulnerable versions of @remix-run/router
  node_modules/react-router
    react-router-dom  6.4.1-pre.0 - 6.30.3
    Depends on vulnerable versions of @remix-run/router
    Depends on vulnerable versions of react-router
    node_modules/react-router-dom

ajv  <6.14.0
Severity: moderate
ajv has ReDoS when using `$data` option - https://github.com/advisories/GHSA-2g4f-4pwh-qvx6
fix available via `npm audit fix`
node_modules/ajv

axios  1.0.0 - 1.15.2
Severity: high
Axios has a NO_PROXY Hostname Normalization Bypass that Leads to SSRF - https://github.com/advisories/GHSA-3p68-rc4w-qgx5
Axios: Authentication Bypass via Prototype Pollution Gadget in `validateStatus` Merge Strategy - https://github.com/advisories/GHSA-w9j2-pvgh-6h63
Axios: Incomplete Fix for CVE-2025-62718 ΓÇö NO_PROXY Protection Bypassed via RFC 1122 Loopback Subnet (127.0.0.0/8) in Axios 1.15.0 - https://github.com/advisories/GHSA-pmwg-cvhr-8vh7
Axios: Invisible JSON Response Tampering via Prototype Pollution Gadget in `parseReviver` - https://github.com/advisories/GHSA-3w6x-2g7m-8v23
Axios: Null Byte Injection via Reverse-Encoding in AxiosURLSearchParams - https://github.com/advisories/GHSA-xhjh-pmcv-23jw
Axios: CRLF Injection in multipart/form-data body via unsanitized blob.type in formDataToStream - https://github.com/advisories/GHSA-445q-vr5w-6q77
Axios: no_proxy bypass via IP alias allows SSRF - https://github.com/advisories/GHSA-m7pr-hjqh-92cm
Axios: unbounded recursion in toFormData causes DoS via deeply nested request data - https://github.com/advisories/GHSA-62hf-57xw-28j9
Axios' HTTP adapter-streamed uploads bypass maxBodyLength when maxRedirects: 0 - https://github.com/advisories/GHSA-5c9x-8gcm-mpgx
Axios: HTTP adapter streamed responses bypass maxContentLength - https://github.com/advisories/GHSA-vf2m-468p-8v99
Axios: Prototype Pollution Gadgets - Response Tampering, Data Exfiltration, and Request Hijacking - https://github.com/advisories/GHSA-pf86-5x62-jrwf
Axios: Header Injection via Prototype Pollution - https://github.com/advisories/GHSA-6chq-wfr3-2hj9
Axios: XSRF Token Cross-Origin Leakage via Prototype Pollution Gadget in `withXSRFToken` Boolean Coercion - https://github.com/advisories/GHSA-xx6v-rp6x-q39c
Axios is Vulnerable to Denial of Service via __proto__ Key in mergeConfig - https://github.com/advisories/GHSA-43fc-jf86-j433
Axios has prototype pollution read-side gadgets in HTTP adapter that allow credential injection and request hijacking - https://github.com/advisories/GHSA-q8qp-cvcw-x6jj
Axios has Unrestricted Cloud Metadata Exfiltration via Header Injection Chain - https://github.com/advisories/GHSA-fvcv-3m26-pcqx
axios's shouldBypassProxy does not recognize IPv4-mapped IPv6 addresses, allowing NO_PROXY bypass (incomplete fix for CVE-2025-62718) - https://github.com/advisories/GHSA-pjwm-pj3p-43mv
axios has DoS & Header Injection via Prototype Pollution Read-Side Gadgets in axios merge functions - https://github.com/advisories/GHSA-898c-q2cr-xwhg
axios Vulnerable to Credential Theft and Response Hijacking via Prototype Pollution Gadget in Config Merge - https://github.com/advisories/GHSA-3g43-6gmg-66jw
axios Vulnerable to Full Man-in-the-Middle via Prototype Pollution Gadget in `config.proxy` - https://github.com/advisories/GHSA-35jp-ww65-95wh
fix available via `npm audit fix`
node_modules/axios

brace-expansion  <1.1.13
Severity: moderate
brace-expansion: Zero-step sequence causes process hang and memory exhaustion - https://github.com/advisories/GHSA-f886-m6hf-6m8v
fix available via `npm audit fix`
node_modules/brace-expansion

esbuild  <=0.24.2
Severity: moderate
esbuild enables any website to send any requests to the development server and read the response - https://github.com/advisories/GHSA-67mh-4wv8-2f99
fix available via `npm audit fix --force`
Will install vite@8.0.16, which is a breaking change
node_modules/esbuild
  vite  <=6.4.1
  Depends on vulnerable versions of esbuild
  node_modules/vite

flatted  <=3.4.1
Severity: high
flatted vulnerable to unbounded recursion DoS in parse() revive phase - https://github.com/advisories/GHSA-25h7-pfq9-p65f
Prototype Pollution via parse() in NodeJS flatted - https://github.com/advisories/GHSA-rf6f-7fwh-wjgh
fix available via `npm audit fix`
node_modules/flatted

follow-redirects  <=1.15.11
Severity: moderate
follow-redirects leaks Custom Authentication Headers to Cross-Domain Redirect Targets - https://github.com/advisories/GHSA-r4q5-vmmm-2653
fix available via `npm audit fix`
node_modules/follow-redirects

minimatch  <=3.1.3
Severity: high
minimatch has a ReDoS via repeated wildcards with non-matching literal in pattern - https://github.com/advisories/GHSA-3ppc-4f35-3m26
minimatch has ReDoS: matchOne() combinatorial backtracking via multiple non-adjacent GLOBSTAR segments - https://github.com/advisories/GHSA-7r86-cg39-jmmj
minimatch ReDoS: nested *() extglobs generate catastrophically backtracking regular expressions - https://github.com/advisories/GHSA-23c5-xmqv-rm74
fix available via `npm audit fix`
node_modules/minimatch

picomatch  <=2.3.1 || 4.0.0 - 4.0.3
Severity: high
Picomatch: Method Injection in POSIX Character Classes causes incorrect Glob Matching - https://github.com/advisories/GHSA-3v7f-55p6-f55p
Picomatch: Method Injection in POSIX Character Classes causes incorrect Glob Matching - https://github.com/advisories/GHSA-3v7f-55p6-f55p
Picomatch has a ReDoS vulnerability via extglob quantifiers - https://github.com/advisories/GHSA-c2c7-rcm5-vvqj
Picomatch has a ReDoS vulnerability via extglob quantifiers - https://github.com/advisories/GHSA-c2c7-rcm5-vvqj
fix available via `npm audit fix`
node_modules/picomatch
node_modules/tinyglobby/node_modules/picomatch

postcss  <8.5.10
Severity: moderate
PostCSS has XSS via Unescaped </style> in its CSS Stringify Output - https://github.com/advisories/GHSA-qx2v-qp2m-jg93
fix available via `npm audit fix`
node_modules/postcss


rollup  4.0.0 - 4.58.0
Severity: high
Rollup 4 has Arbitrary File Write via Path Traversal - https://github.com/advisories/GHSA-mw96-cpmx-2vgc
fix available via `npm audit fix`
node_modules/rollup


14 vulnerabilities (6 moderate, 8 high)

To address issues that do not require attention, run:
  npm audit fix

To address all issues (including breaking changes), run:
  npm audit fix --force
