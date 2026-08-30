"""
HackSentinel Prediction API v2.0
=================================
FastAPI sidecar on port 8000 serving Model A predictions.

Endpoints:
  GET  /health           - Health check, model load status
  POST /api/predict      - Raw prediction from text
  POST /api/scan/passive - Passive scan + Model A prediction

Loads trained models from models/ directory on startup.

Author: HackSentinel
"""

import os
import json
import time
import pickle
import re
import asyncio
import uuid
from contextlib import asynccontextmanager
from urllib.parse import urlparse, parse_qs
import numpy as np

try:
    import xgboost as xgb
except ImportError:
    print("[!] Missing library. Run: pip install xgboost")
    raise SystemExit(1)

try:
    import lightgbm as lgb
except ImportError:
    print("[!] Missing library. Run: pip install lightgbm")
    raise SystemExit(1)

try:
    from fastapi import FastAPI, HTTPException, Request
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
    import uvicorn
except ImportError:
    print("[!] Missing libraries. Run: pip install fastapi uvicorn")
    raise SystemExit(1)

try:
    import httpx
except ImportError:
    print("[!] Missing library. Run: pip install httpx")
    raise SystemExit(1)

try:
    import redis as _redis_lib
    _redis_client = _redis_lib.Redis(host='localhost', port=6379, db=0, decode_responses=True,
                                     socket_connect_timeout=1)
    _redis_client.ping()
    _REDIS_AVAILABLE = True
    print("[*] Redis cache connected (localhost:6379)")
except Exception:
    _redis_client = None
    _REDIS_AVAILABLE = False
    print("[!] Redis unavailable — using in-memory cache fallback")


# ──────────────────────────────────────────────
# Models & Config
# ──────────────────────────────────────────────

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(SCRIPT_DIR, "models")
MERGED_DATA_DIR = os.path.join(SCRIPT_DIR, "merged_data")
CVE_LOOKUP_CACHE = os.path.join(MERGED_DATA_DIR, "cve_lookup_index.json")

# Global model state
models = {
    'loaded': False,
    'category_model': {},
    'category_calibrators': {},
    'severity_model': None,
    'tfidf': None,
    'text_svd': None,
    'scaler': None,
    'category_encoder': None,
    'severity_encoder': None,
    'feature_config': None,
    'specialized': {},
}

# Global RAG retriever (loaded on startup if vector_db/ exists)
rag_retriever = None

# Scan result cache (Redis if available, else in-memory fallback)
_SCAN_CACHE: dict = {}          # used only when Redis is unavailable
_SCAN_CACHE_TTL = 300           # 5 minutes
_REDIS_CACHE_KEY = "hs:scan:"   # Redis key prefix
_RATE_LIMIT = 10                # max scans per IP per minute
_RATE_WINDOW = 60               # seconds
_MEM_RATE_STORE: dict = {}      # {ip: [timestamp, ...]} for in-memory rate limiting
cve_lookup_db = {
    'loaded': False,
    'by_tech': {},
    'record_count': 0,
    'cache_path': CVE_LOOKUP_CACHE,
}

SECURITY_HEADERS = [
    'Strict-Transport-Security',
    'Content-Security-Policy',
    'X-Content-Type-Options',
    'X-Frame-Options',
    'X-XSS-Protection',
    'Referrer-Policy',
    'Permissions-Policy',
    'Cross-Origin-Opener-Policy',
    'Cross-Origin-Embedder-Policy',
]

URL_RE = re.compile(r'https?://\S+|www\.\S+', re.I)
RISKY_URL_PARAMS = {'id', 'file', 'path', 'redirect', 'url', 'next', 'return', 'returnurl', 'dest'}
LOGIN_HINTS = ('login', 'signin', 'sign in', 'password', 'username', 'otp', 'mfa')
UPLOAD_HINTS = ('upload', 'multipart/form-data', 'type file', 'file input')
SEARCH_HINTS = ('search', 'q=', 'query', 'keyword')
ERROR_HINTS = ('traceback', 'stack trace', 'exception', 'fatal error', 'warning:', 'notice:', 'syntax error')
STACK_HINTS = ('traceback', 'stack trace', 'at line ', 'exception in thread', 'nullpointerexception')
VERSION_HINTS = (
    'x-powered-by', 'server:', 'version ', 'powered by php', 'apache/', 'nginx/', 'php/',
    'jquery 1.', 'jquery-1.', 'bootstrap 3.', 'angularjs', 'vue 2.', 'wordpress 4.'
)
COOKIE_HINTS = {'httponly': 'has_cookie_httponly', 'secure': 'has_cookie_secure', 'samesite': 'has_cookie_samesite'}
TECH_KEYWORDS = {
    'tech_php': ('php',),
    'tech_aspnet': ('asp.net', 'aspnet'),
    'tech_wordpress': ('wordpress',),
    'tech_drupal': ('drupal',),
    'tech_joomla': ('joomla',),
    'tech_laravel': ('laravel',),
    'tech_django': ('django',),
    'tech_flask': ('flask', 'werkzeug'),
    'tech_nodejs': ('node.js', 'nodejs', 'express'),
    'tech_react': ('react', 'next.js', '_next/'),
}
DEFAULT_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
]

# Vulnerability Category Patterns for Feature Engineering
_VULN_CATEGORIES = {
    'sqli': [r'sql injection', r'sqli', r'select .* from', r'union select', r'database error', r'sql syntax'],
    'xss': [r'cross site scripting', r'xss', r'javascript:', r'alert\(', r'onerror=', r'script>'],
    'rce': [r'remote code execution', r'rce', r'eval\(', r'exec\(', r'system\(', r'shell_exec'],
    'lfi': [r'local file inclusion', r'lfi', r'\/etc\/passwd', r'..\/\.\.', r'filename='],
    'ssrf': [r'server side request forgery', r'ssrf', r'169.254.169.254', r'localhost', r'127.0.0.1'],
    'idor': [r'insecure direct object reference', r'idor', r'user_id=', r'account_id='],
    'info_disclosure': [r'information disclosure', r'exposed', r'sensitive', r'config', r'backup', r'dump'],
    'auth_bypass': [r'authentication bypass', r'login bypass', r'admin panel', r'unauthenticated'],
}
_CAT_COMPILED = {k: [re.compile(p, re.I) for p in v] for k, v in _VULN_CATEGORIES.items()}

# Security Analysis Hints
_POC_HINTS = ('poc', 'proof of concept', 'reproducible', 'exploit', 'payload', 'curl -X', 'http://')
_REMEDIATION_HINTS = ('fix', 'remediation', 'mitigation', 'patch', 'update to', 'secure version', 'sanitize')
_IMPACT_HINTS = ('impact', 'risk', 'business logic', 'confidentiality', 'integrity', 'availability', 'critical')

# ──────────────────────────────────────────────
# Comprehensive Tech Fingerprints (Wappalyzer-style)
# ──────────────────────────────────────────────
# Keys: h=headers string, b=body text, c=Set-Cookie header,
#       m=<meta generator> content, s=<script src> attributes

def _compile(p):
    return re.compile(p, re.I) if p else None


def _extract_version_strings(text: str) -> list[str]:
    """Extract compact version tokens like 4.2, 7.4.33, 22.001.20085."""
    if not text:
        return []
    versions = re.findall(r'\b\d+(?:\.\d+){1,3}\b', text)
    seen = set()
    result = []
    for version in versions:
        if version not in seen:
            seen.add(version)
            result.append(version)
        if len(result) >= 12:
            break
    return result

_TECH_FP_RAW = {
    # ── Web Servers ──
    'Apache':        {'h': r'Apache',                                    'b': r''},
    'Nginx':         {'h': r'nginx',                                     'b': r''},
    'IIS':           {'h': r'Microsoft-IIS',                             'b': r''},
    'Tomcat':        {'h': r'Apache-Coyote|Coyote',                      'b': r'Apache Tomcat',           'c': r'JSESSIONID'},
    'LiteSpeed':     {'h': r'LiteSpeed|LSCache',                         'b': r''},

    # ── CDN / Cloud ──
    'CloudFlare':    {'h': r'cloudflare|cf-ray|cf-cache-status',         'b': r'',                        'c': r'__cfduid|cf_clearance'},
    'AWS':           {'h': r'AmazonS3|awselb|CloudFront|x-amz-',        'b': r''},
    'Azure':         {'h': r'x-ms-request-id|ARRAffinity|X-Azure',       'b': r'',                        'c': r'ARRAffinity'},
    'GCP':           {'h': r'x-goog-|via:.*google',                      'b': r''},
    'Fastly':        {'h': r'X-Served-By|Fastly-Debug-Digest',           'b': r''},

    # ── Backend Languages ──
    'PHP':           {'h': r'X-Powered-By:.*PHP|^PHP/',                  'b': r'\.php[\?#"\s]|PHPSESSID',  'c': r'PHPSESSID'},
    'ASP.NET':       {'h': r'ASP\.NET|X-AspNet|X-AspNetMvc',             'b': r'__VIEWSTATE|__EVENTVALIDATION|\.aspx',  'c': r'ASP\.NET_SessionId'},
    'Node.js':       {'h': r'X-Powered-By:.*Express|X-Powered-By:.*node','b': r'',                        'c': r'connect\.sid'},

    # ── Web Frameworks ──
    'Django':        {'h': r'Django|wsgiref',                            'b': r'csrfmiddlewaretoken',      'c': r'csrftoken|^sessionid$'},
    'Flask':         {'h': r'Werkzeug',                                  'b': r'werkzeug|flask',           'c': r'session'},
    'Laravel':       {'h': r'',                                          'b': r'laravel|/vendor/phpunit',  'c': r'laravel_session|XSRF-TOKEN'},
    'CodeIgniter':   {'h': r'',                                          'b': r'CodeIgniter|ci_session',   'c': r'ci_session|ci_csrf_token'},
    'Symfony':       {'h': r'X-Debug-Token|X-Symfony-Cache',            'b': r'symfony|/bundles/framework','c': r'SYMFONY_DEBUG|sf2_functional_'},
    'Spring Boot':   {'h': r'X-Application-Context',                    'b': r'Whitelabel Error Page',    'c': r'JSESSIONID'},
    'Rails':         {'h': r'X-Runtime|X-Powered-By:.*Phusion',         'b': r'authenticity_token',       'c': r'_.*_session|remember_user_token'},
    'CakePHP':       {'h': r'',                                          'b': r'cakephp',                  'c': r'CAKEPHP'},
    'Yii':           {'h': r'',                                          'b': r'yii framework|yii\.js',    'c': r'_csrf|YII_CSRF_TOKEN'},

    # ── CMS ──
    'WordPress':     {'h': r'X-Pingback',                                'b': r'/wp-content/|/wp-includes/', 'c': r'wordpress_|wp-settings-|woocommerce_',
                      'm': r'WordPress', 's': r'/wp-includes/js/|/wp-content/plugins/|/wp-content/themes/'},
    'Joomla':        {'h': r'',                                          'b': r'/media/jui/|/media/system/', 'c': r'joomla_user_state',
                      'm': r'Joomla', 's': r'/media/jui/js/|/media/system/js/'},
    'Drupal':        {'h': r'X-Drupal-Cache|X-Drupal-Dynamic-Cache',    'b': r'/sites/default/files/|/misc/drupal\.js', 'c': r'SESS[0-9a-f]{32}|Drupal\.visitor',
                      'm': r'Drupal', 's': r'/misc/drupal\.js|/sites/all/'},
    'Magento':       {'h': r'',                                          'b': r'Mage\.|/skin/frontend/',   'c': r'^frontend$|^adminhtml$',
                      'm': r'Magento', 's': r'/skin/frontend/|/js/mage/'},
    'Shopify':       {'h': r'X-ShopId|X-ShardId',                       'b': r'Shopify\.theme|cdn\.shopify\.com', 'c': r'_shopify_|^cart$',
                      'm': r'Shopify', 's': r'cdn\.shopify\.com'},
    'PrestaShop':    {'h': r'',                                          'b': r'prestashop',               'c': r'PrestaShop-', 'm': r'PrestaShop'},
    'OpenCart':      {'h': r'',                                          'b': r'OpenCart|catalog/view/theme/', 'c': r'', 'm': r'OpenCart'},
    'TYPO3':         {'h': r'',                                          'b': r'typo3|TYPO3',              'c': r'fe_typo_user|be_typo_user', 'm': r'TYPO3'},
    'Wix':           {'h': r'X-Wix-Request-Id',                         'b': r'wix\.com|_wixCIDX',        'c': r'_wixCIDX'},

    # ── JS Frameworks / Libraries ──
    'React':         {'h': r'',                                          'b': r'__reactFiber|_reactRootContainer|react-root',
                      's': r'react\.min\.js|react-dom|/static/js/main\.[a-f0-9]+\.chunk\.js'},
    'Angular':       {'h': r'',                                          'b': r'ng-version|ng-app\b',
                      's': r'angular\.min\.js|angular\.js'},
    'Vue.js':        {'h': r'',                                          'b': r'__vue__|__vue_app__|data-v-[a-f0-9]+|v-bind:',
                      's': r'vue\.min\.js|vue\.runtime|/vue@\d'},
    'Next.js':       {'h': r'X-Powered-By:.*Next\.js',                  'b': r'__NEXT_DATA__|_next/static/',
                      's': r'/_next/static/'},
    'Nuxt.js':       {'h': r'',                                          'b': r'__NUXT__|_nuxt/',
                      's': r'/_nuxt/'},
    'jQuery':        {'h': r'',                                          'b': r'jQuery\.fn\.jquery',
                      's': r'jquery[\.\-][\d\.]+(?:\.min)?\.js'},
    'Bootstrap':     {'h': r'',                                          'b': r'',
                      's': r'bootstrap\.min\.js|bootstrap\.bundle\.min'},

    # ── Database errors exposed ──
    'MySQL':         {'h': r'', 'b': r'mysql_fetch|mysql_error|mysql_connect|You have an error in your SQL syntax'},
    'MongoDB':       {'h': r'', 'b': r'MongoError|MongoNetworkError'},
    'PostgreSQL':    {'h': r'', 'b': r'pg_query|PostgreSQL.*ERROR|ERROR.*postgresql'},
    'Redis':         {'h': r'', 'b': r'WRONGTYPE Operation.*Redis|RedisException'},
    'Elasticsearch': {'h': r'X-elastic-product', 'b': r'elasticsearch'},

    # ── Admin / Dev tools exposed ──
    'phpMyAdmin':    {'h': r'', 'b': r'phpMyAdmin|phpmyadmin', 'c': r'phpMyAdmin|pma_'},
    'Adminer':       {'h': r'', 'b': r'Adminer \d+\.\d+',     'c': r'adminer_'},

    # ── Web Servers / Reverse Proxies (new) ──
    'Varnish':       {'h': r'X-Varnish|Via:.*varnish',                              'b': r''},
    'Caddy':         {'h': r'Server:\s*Caddy',                                       'b': r''},
    'Traefik':       {'h': r'X-Forwarded-Server:.*traefik|Server:\s*[Tt]raefik',    'b': r''},
    'HAProxy':       {'h': r'Server:\s*haproxy|X-Haproxy-Server-State',             'b': r''},
    'OpenResty':     {'h': r'Server:\s*openresty',                                   'b': r''},

    # ── JS Build Tools ──
    'Webpack':       {'b': r'webpackJsonp|__webpack_require__|webpackChunk',
                      's': r'/static/chunks/'},
    'Vite':          {'b': r'/@vite/client',
                      's': r'/@vite/client|/@vite/'},

    # ── Frontend Meta-Frameworks ──
    'Gatsby':        {'b': r'___gatsby|gatsby-focus-wrapper',
                      's': r'/gatsby-chunk-mapping|page-data\.json'},
    'SvelteKit':     {'b': r'__sveltekit|sveltekit:start',
                      's': r'/_app/immutable/'},
    'Astro':         {'b': r'astro-island|data-astro-cid-',
                      's': r'/_astro/'},
    'Remix':         {'b': r'__remixContext|__remixRouteModules',
                      's': r'/_remix/'},
    'Svelte':        {'b': r'svelte-[a-z0-9]+|__svelte',
                      's': r'svelte\.min\.js|/svelte/'},

    # ── CMS (new) ──
    'Ghost':         {'b': r'ghost-content|ghost\.io',   'm': r'Ghost',   's': r'/ghost/'},
    'Strapi':        {'h': r'X-Strapi-Version',          'b': r'strapi',  's': r'/strapi-admin/'},
    'Payload CMS':   {'h': r'X-Payload-Version',         'b': r'payload-cms'},
}

# Compile all patterns at import time
TECH_FINGERPRINTS = {
    tech: {
        'header': _compile(v.get('h')) if v.get('h') else None,
        'body':   _compile(v.get('b')) if v.get('b') else None,
        'cookie': _compile(v.get('c')) if v.get('c') else None,
        'meta':   _compile(v.get('m')) if v.get('m') else None,
        'script': _compile(v.get('s')) if v.get('s') else None,
    }
    for tech, v in _TECH_FP_RAW.items()
}

# ──────────────────────────────────────────────
# Common paths to probe for tech/vuln discovery
# ──────────────────────────────────────────────
# Tuple: (path, tech_hint_if_found, vuln_signal_text, get_body)
PROBE_PATHS = [
    ('/.git/HEAD',           None,           'information disclosure exposed git repository source code',           False),
    ('/.env',                None,           'critical information disclosure exposed environment variables credentials', False),
    ('/phpinfo.php',         'PHP',          'information disclosure exposed php configuration server details',     True),
    ('/.git/config',         None,           'information disclosure exposed git configuration remotes',            True),
    ('/wp-config.php.save',  'WordPress',    'critical information disclosure backup wordpress config',              False),
    ('/.vscode/sftp.json',   None,           'critical information disclosure leaked sftp credentials',             False),
    ('/.ssh/id_rsa',         None,           'critical information disclosure leaked private ssh key',              False),
    ('/actuator/env',        'Spring Boot',  'critical information disclosure exposed spring boot actuator env',     True),
    ('/.bash_history',       None,           'critical information disclosure leaked shell history',                False),
    ('/dump.sql',            'MySQL',        'critical information disclosure database dump file',                   False),
    ('/backup.zip',          None,           'critical information disclosure exposed backup archive',              False),
    ('/.env.backup',         None,           'critical information disclosure exposed environment backup',           False),
    ('/composer.json',       'PHP',          'information disclosure leaked php dependencies',                      True),
    ('/package.json',        'Node.js',      'information disclosure leaked project dependencies',                  True),
    ('/.htaccess',           'Apache',       'information disclosure apache htaccess configuration file',           False),
    ('/web.config',          'IIS',          'information disclosure iis web.config sensitive configuration',       False),
    ('/wp-login.php',        'WordPress',    'wordpress login panel authentication brute force',                    False),
    ('/wp-json/wp/v2/users', 'WordPress',    'wordpress user enumeration rest api information disclosure idor',     True),
    ('/xmlrpc.php',          'WordPress',    'wordpress xmlrpc endpoint brute force amplification',                 False),
    ('/administrator/',      'Joomla',       'joomla administrator panel exposed brute force authentication',       False),
    ('/user/login',          'Drupal',       'drupal user login panel exposed',                                     False),
    ('/phpmyadmin/',         'phpMyAdmin',   'phpmyadmin database admin panel exposed sql injection',              False),
    ('/adminer.php',         'Adminer',      'adminer database admin panel exposed information disclosure',         False),
    ('/swagger-ui.html',     None,           'swagger api documentation exposed sensitive endpoint enumeration',    False),
    ('/robots.txt',          None,           'information disclosure robots.txt analysis',                          True),
    ('/pma/',                'phpMyAdmin',   'phpmyadmin database admin panel exposed sql injection',              False),
    ('/swagger/',            None,           'swagger api documentation exposed information disclosure',            False),
    ('/api-docs/',           None,           'api documentation exposed information disclosure',                    False),
    ('/graphql',             'GraphQL',      'graphql endpoint exposed injection information disclosure',           False),
    ('/actuator',            'Spring Boot',  'spring boot actuator exposed sensitive management endpoints',         True),
    ('/actuator/env',        'Spring Boot',  'spring boot actuator env endpoint sensitive configuration exposure',  True),
    ('/robots.txt',          None,           None,                                                                   True),
    ('/sitemap.xml',         None,           None,                                                                   False),
    ('/crossdomain.xml',     None,           'crossdomain xml misconfiguration csrf ssrf flash policy',             False),
    ('/ghost/',              'Ghost',        'ghost cms admin panel exposed information disclosure',                 False),
    ('/django-admin/',       'Django',       'django admin panel exposed authentication brute force',               False),
    ('/rails/info/properties','Rails',       'rails info endpoint exposed sensitive framework information',         True),
    ('/strapi/admin',        'Strapi',       'strapi headless cms admin panel exposed',                             False),
    ('/health',              None,           None,                                                                   False),
    ('/healthz',             None,           None,                                                                   False),
]

# Error page patterns for framework fingerprinting
_ERROR_PAGE_PATTERNS = [
    (r'Apache.*Server at|Apache HTTP Server', 'Apache'),
    (r'<center>nginx</center>|nginx.*404',   'Nginx'),
    (r'Microsoft-IIS|IIS.*Error',            'IIS'),
    (r'Whitelabel Error Page',               'Spring Boot'),
    (r'Werkzeug Debugger|werkzeug\.exceptions', 'Flask'),
    (r'Page not found.*Django|Using the URLconf', 'Django'),
    (r'ActionController|No route matches.*Rails', 'Rails'),
    (r'Apache Tomcat|Coyote HTTP',           'Tomcat'),
    (r'Illuminate\\|Whoops.*Framework',      'Laravel'),
    (r'Cannot GET |Cannot POST ',            'Node.js'),
    (r'@nestjs|NestFactory|Nest application', 'NestJS'),
    (r'SvelteKitError|sveltekit:start',      'SvelteKit'),
]

# ──────────────────────────────────────────────
# Technology → Vulnerability Mapping
# ──────────────────────────────────────────────
TECH_VULN_MAP = {
    'PHP': [
        'sql injection database query parameter',
        'remote code execution command injection eval',
        'file inclusion lfi rfi local remote file',
        'cross site scripting xss potential',
    ],
    'ASP.NET': [
        'sql injection sqli database query parameter mssql',
        'cross site scripting xss reflected stored',
        'insecure deserialization viewstate',
    ],
    'Apache': [
        'server misconfiguration directory listing traversal',
        'remote code execution rce cgi',
    ],
    'Tomcat': [
        'remote code execution rce deserialization java',
        'server misconfiguration tomcat manager default credentials',
        'information disclosure server version',
    ],
    'IIS': [
        'server misconfiguration iis short name enumeration',
        'sql injection sqli database query parameter mssql',
    ],
    'Node.js': [
        'server side request forgery ssrf',
        'cross site scripting xss reflected dom',
        'prototype pollution injection',
        'path traversal directory listing',
    ],
    'Django': [
        'cross site request forgery csrf token',
        'sql injection sqli orm raw query',
        'server side template injection ssti',
    ],
    'Flask': [
        'server side template injection ssti jinja2',
        'cross site scripting xss reflected',
        'insecure direct object reference idor',
    ],
    'Laravel': [
        'sql injection sqli eloquent raw query',
        'cross site scripting xss blade template',
        'remote code execution rce deserialization php',
        'information disclosure debug mode laravel',
    ],
    'Spring Boot': [
        'remote code execution rce java deserialization',
        'server side request forgery ssrf actuator',
        'information disclosure actuator endpoint exposure',
    ],
    'Rails': [
        'sql injection sqli activerecord',
        'remote code execution rce ruby deserialization',
        'cross site request forgery csrf authenticity token',
    ],
    'AWS': [
        'server side request forgery ssrf metadata endpoint',
        'cloud misconfiguration s3 bucket policy exposure',
        'information disclosure sensitive data exposure',
    ],
    'Azure': [
        'server side request forgery ssrf metadata',
        'information disclosure sensitive data exposure',
    ],
    'WordPress': [
        'sql injection sqli wordpress plugin theme',
        'cross site scripting xss wordpress stored reflected',
        'authentication bypass wordpress xmlrpc',
        'remote code execution rce wordpress plugin',
        'information disclosure user enumeration wordpress',
    ],
    'Joomla': [
        'sql injection sqli joomla component',
        'remote code execution rce joomla extension',
        'authentication bypass joomla admin',
    ],
    'Drupal': [
        'remote code execution rce drupalgeddon',
        'sql injection sqli drupal module',
        'access control bypass drupal permissions',
    ],
    'Magento': [
        'sql injection sqli magento',
        'remote code execution rce magento',
        'information disclosure magento admin',
    ],
    'Shopify': [
        'information disclosure shopify api key',
        'insecure direct object reference idor shopify',
    ],
    'phpMyAdmin': [
        'sql injection sqli phpmyadmin database',
        'authentication bypass phpmyadmin default credentials',
        'remote code execution rce phpmyadmin',
        'information disclosure database admin panel exposed',
    ],
    'MySQL': [
        'sql injection sqli database error exposure',
        'information disclosure mysql error message',
    ],
    'MongoDB': [
        'nosql injection mongodb',
        'information disclosure mongodb error',
    ],
    'Elasticsearch': [
        'information disclosure elasticsearch unauthenticated access',
        'server side request forgery ssrf elasticsearch',
    ],
    'GraphQL': [
        'information disclosure graphql introspection schema',
        'injection graphql query manipulation',
        'insecure direct object reference idor graphql',
    ],
    'React': [
        'cross site scripting xss dom based react',
        'information disclosure source map exposed',
    ],
    'Next.js': [
        'server side request forgery ssrf next.js',
        'information disclosure next.js debug mode',
    ],
    'Vue.js': [
        'cross site scripting xss dom based vue',
        'information disclosure source map exposed',
    ],
    'Angular': [
        'cross site scripting xss dom based angular template injection',
        'information disclosure source map exposed',
    ],
    'jQuery': [
        'cross site scripting xss dom based jquery',
        'insecure deserialization jquery ajax csrf',
    ],
    'PostgreSQL': [
        'sql injection sqli postgresql error database',
        'information disclosure postgresql error message',
    ],
    'Redis': [
        'information disclosure redis unauthenticated access',
        'server side request forgery ssrf redis internal',
    ],
    'Elasticsearch': [
        'information disclosure elasticsearch unauthenticated sensitive data',
        'server side request forgery ssrf elasticsearch internal',
    ],
    'GraphQL': [
        'information disclosure graphql introspection schema endpoint',
        'injection graphql query manipulation',
        'insecure direct object reference idor graphql',
    ],
    'AWS': [
        'server side request forgery ssrf aws metadata endpoint 169.254.169.254',
        'cloud misconfiguration s3 bucket public access exposure',
        'information disclosure aws credentials environment variable',
    ],
    'Azure': [
        'server side request forgery ssrf azure metadata endpoint',
        'information disclosure azure storage account key exposure',
    ],
    'GCP': [
        'server side request forgery ssrf gcp metadata endpoint',
        'information disclosure google cloud credentials exposure',
    ],
    'CloudFlare': [
        'information disclosure real ip bypass cloudflare',
        'open redirect host header injection cloudflare',
    ],
    'Shopify': [
        'information disclosure shopify api key secret exposure',
        'insecure direct object reference idor shopify storefront',
    ],
    'phpMyAdmin': [
        'sql injection sqli phpmyadmin database admin panel exposed',
        'authentication bypass phpmyadmin default credentials brute force',
        'remote code execution rce phpmyadmin sql query execution',
    ],
    'Adminer': [
        'information disclosure adminer database admin exposed',
        'sql injection sqli adminer database panel brute force',
    ],
    'Wix': [
        'information disclosure wix api key exposed',
        'cross site scripting xss wix embedded widget',
    ],
    'TYPO3': [
        'remote code execution rce typo3 extension',
        'sql injection sqli typo3 database query',
        'authentication bypass typo3 admin credentials',
    ],
}

# ──────────────────────────────────────────────
# WAF / CDN Signatures
# ──────────────────────────────────────────────
WAF_SIGNATURES = {
    'Cloudflare':  [('h','cf-ray'),('h','cf-cache-status'),('c','__cfduid'),('c','cf_clearance')],
    'AWS WAF':     [('h','x-amzn-requestid'),('h','x-amz-cf-id'),('h','x-cache')],
    'Akamai':      [('h','x-akamai-transformed'),('h','x-check-cacheable'),('h','x-akamai-ssl')],
    'Imperva':     [('c','incap_ses'),('c','visid_incap'),('h','x-iinfo')],
    'ModSecurity': [('h','x-modsecurity'),('b','mod_security'),('b','modsecurity')],
    'Sucuri':      [('h','x-sucuri-id'),('h','x-sucuri-cache')],
    'F5 BIG-IP':   [('c','bigipserver'),('h','x-cnection'),('h','x-wa-info')],
    'Wordfence':   [('b','wordfence'),('h','x-wordfence-blocked')],
    'Fortinet':    [('h','fortigate'),('c','fgcsrftoken')],
    'PerimeterX':  [('h','x-px-vid'),('c','_px2'),('c','_px3')],
}

# Patterns for secrets exposed in JS files
JS_SECRET_PATTERNS = [
    (r'(?:api[_-]?key|apikey)\s*[:=]\s*["\']([A-Za-z0-9_\-]{20,})["\']', 'API Key'),
    (r'AKIA[0-9A-Z]{16}', 'AWS Access Key'),
    (r'(?:secret[_-]?key|secret_access_key)\s*[:=]\s*["\']([A-Za-z0-9_\-/+]{20,})["\']', 'Secret Key'),
    (r'-----BEGIN (?:RSA |EC |)PRIVATE KEY-----', 'Private Key'),
    (r'(?:password|passwd)\s*[:=]\s*["\']([^"\'\\]{6,})["\']', 'Hardcoded Password'),
    (r'(?:token|auth[_-]?token|access[_-]?token)\s*[:=]\s*["\']([A-Za-z0-9_\-\.]{20,})["\']', 'Auth Token'),
    (r'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}', 'JWT Token'),
    (r'(?:database[_-]?url|db[_-]?url|mongo(?:db)?[_-]?uri)\s*[:=]\s*["\']([^"\']+)["\']', 'Database URL'),
    (r'(?:stripe)[_\-]?(?:secret|live|test)[_\-]?key\s*[:=]\s*["\']([A-Za-z0-9_\-]{20,})["\']', 'Stripe Key'),
    (r'(?:sendgrid|mailgun|twilio)[_\-]?(?:api[_-]?key|key|token)\s*[:=]\s*["\']([A-Za-z0-9_\-]{20,})["\']', 'Email API Key'),
    (r'/api/v[0-9]+/[a-zA-Z0-9/_-]{3,}', 'API Endpoint'),
    (r'(?:client[_-]?id)\s*[:=]\s*["\']([A-Za-z0-9_\-]{10,})["\']', 'OAuth Client ID'),
]

# Ports to check with their vuln context
COMMON_PORTS = {
    21:    ('ftp',           'information disclosure ftp service exposed file transfer brute force'),
    22:    ('ssh',           'information disclosure ssh service exposed brute force credential'),
    23:    ('telnet',        'information disclosure telnet plaintext credentials exposed'),
    25:    ('smtp',          'information disclosure smtp email service exposed'),
    3306:  ('mysql',         'information disclosure mysql database exposed sql injection'),
    5432:  ('postgresql',    'information disclosure postgresql database exposed sql injection'),
    6379:  ('redis',         'information disclosure redis database unauthenticated access'),
    8080:  ('http-alt',      'information disclosure alternative http admin panel exposed'),
    8443:  ('https-alt',     'information disclosure alternative https admin panel'),
    8000:  ('dev-server',    'information disclosure development server exposed rce'),
    9200:  ('elasticsearch', 'information disclosure elasticsearch unauthenticated access data exposure'),
    5601:  ('kibana',        'information disclosure kibana dashboard exposed'),
    27017: ('mongodb',       'information disclosure mongodb unauthenticated access nosql injection'),
    4848:  ('glassfish',     'information disclosure glassfish admin console exposed rce'),
    2181:  ('zookeeper',     'information disclosure zookeeper service exposed'),
    11211: ('memcached',     'information disclosure memcached unauthenticated access'),
    9090:  ('prometheus',    'information disclosure prometheus metrics endpoint exposed'),
    3000:  ('node-dev',      'information disclosure node.js development server exposed'),
    5000:  ('flask-dev',     'information disclosure flask development server exposed rce'),
    4200:  ('angular-dev',   'information disclosure angular dev server exposed'),
}

TECH_CVE_KEYWORDS = {
    'Apache': ['apache http server', 'httpd', 'apache'],
    'Nginx': ['nginx'],
    'IIS': ['internet information services', 'microsoft iis', 'iis'],
    'Tomcat': ['apache tomcat', 'tomcat'],
    'PHP': ['php'],
    'ASP.NET': ['asp.net', 'aspnet'],
    'WordPress': ['wordpress'],
    'Joomla': ['joomla'],
    'Drupal': ['drupal'],
    'Magento': ['magento'],
    'Laravel': ['laravel'],
    'Django': ['django'],
    'Flask': ['flask', 'werkzeug'],
    'Node.js': ['node.js', 'nodejs', 'express'],
    'React': ['react', 'next.js', 'nextjs'],
    'Next.js': ['next.js', 'nextjs'],
    'Vue.js': ['vue.js', 'vuejs', 'vue'],
    'Angular': ['angular', 'angularjs'],
    'jQuery': ['jquery'],
    'Bootstrap': ['bootstrap'],
    'Shopify': ['shopify'],
    'PrestaShop': ['prestashop'],
    'OpenCart': ['opencart'],
    'TYPO3': ['typo3'],
    'phpMyAdmin': ['phpmyadmin'],
    'Adminer': ['adminer'],
}

# Missing header → vulnerability domain language
# NOTE: Keep neutral — avoid repeating XSS keywords for every missing header
# or it biases every prediction toward XSS regardless of actual page content.
MISSING_HEADER_VULN_MAP = {
    'Content-Security-Policy': 'content security policy header absent',
    'X-Frame-Options': 'x frame options header absent',
    'Strict-Transport-Security': 'strict transport security header absent',
    'X-Content-Type-Options': 'x content type options header absent',
    'X-XSS-Protection': 'x xss protection header absent',
    'Referrer-Policy': 'referrer policy header absent',
    'Permissions-Policy': 'permissions policy header absent',
}

# High-risk keyword patterns to scan in page body
VULN_KEYWORD_PATTERNS = {
    'sqli': re.compile(
        r'(sql\s*syntax|mysql_|mysqli_|pg_query|SELECT\s+.*\s+FROM|'
        r'INSERT\s+INTO|UNION\s+SELECT|syntax\s+error.*sql|'
        r'ORA-\d{5}|microsoft\s+ole\s+db|odbc\s+sql|'
        r'postgresql.*error|sqlite.*error|db_query|'
        r'\?id=|\?user=|\?page=|\?cat=)', re.I),
    'xss': re.compile(
        r'(<script|javascript:|onerror\s*=|onload\s*=|onclick\s*=|'
        r'onmouseover\s*=|document\.cookie|document\.write|'
        r'innerHTML|eval\(|alert\(|prompt\(|'
        r'\{\{.*\}\}|\$\{.*\})', re.I),
    'rce': re.compile(
        r'(exec\(|system\(|passthru\(|shell_exec\(|'
        r'popen\(|proc_open\(|eval\(|assert\(|'
        r'Runtime\.getRuntime|ProcessBuilder|'
        r'subprocess|os\.system|os\.popen|'
        r'child_process|spawn\()', re.I),
    'lfi': re.compile(
        r'(include\(|require\(|include_once\(|require_once\(|'
        r'file_get_contents|fopen\(|readfile\(|'
        r'\.\.[\\/]|etc/passwd|/proc/self|'
        r'php://filter|php://input)', re.I),
    'ssrf': re.compile(
        r'(url=|redirect=|next=|dest=|uri=|'
        r'path=|go=|return=|returnTo=|'
        r'callback=|proxy=|forward=)', re.I),
    'csrf': re.compile(
        r'(<form[^>]*method\s*=\s*["\']?post|'
        r'action\s*=|csrf|_token|authenticity_token)', re.I),
    'idor': re.compile(
        r'(user_id=|account_id=|profile_id=|order_id=|'
        r'invoice_id=|document_id=|file_id=)', re.I),
    'info_disclosure': re.compile(
        r'(stack\s*trace|traceback|debug\s*mode|'
        r'internal\s+server\s+error|exception\s+in|'
        r'error\s+in\s+|phpinfo|server\s+at\s+|'
        r'powered\s+by|version\s+\d)', re.I),
}


# ──────────────────────────────────────────────
# Category keyword patterns (mirrors preprocess_data.py v3.0 CATEGORY_KEYWORDS)
# Used to compute cat_score_* features that the model was trained on.
# ──────────────────────────────────────────────
_CAT_PATTERNS_RAW = {
    'xss':              [r'\bxss\b', r'cross.?site.?script', r'<script[\s>]', r'\balert\s*\(', r'\bonerror\s*=',
                         r'javascript:\s*alert', r'reflected\s+xss', r'stored\s+xss', r'dom.?based\s+xss', r'blind\s+xss', r'self.?xss'],
    'sqli':             [r'\bsql\s*injection\b', r'\bsqli\b', r'\bunion\s+select\b', r'blind\s+sql',
                         r"'\s*or\s*1\s*=\s*1", r'\bsqlmap\b', r'error.based\s+sql', r'time.based\s+sql'],
    'ssrf':             [r'\bssrf\b', r'server.?side\s+request\s+forg', r'169\.254\.169\.254',
                         r'metadata\s+endpoint', r'cloud\s+metadata', r'blind\s+ssrf'],
    'idor':             [r'\bidor\b', r'insecure\s+direct\s+object', r'broken\s+access\s+control',
'insecure direct object reference idor graphql',
    ],
    'AWS': [
        'server side request forgery ssrf aws metadata endpoint 169.254.169.254',
        'cloud misconfiguration s3 bucket public access exposure',
        'information disclosure aws credentials environment variable',
    ],
    'Azure': [
        'server side request forgery ssrf azure metadata endpoint',
        'information disclosure azure storage account key exposure',
    ],
    'GCP': [
        'server side request forgery ssrf gcp metadata endpoint',
        'information disclosure google cloud credentials exposure',
    ],
    'CloudFlare': [
        'information disclosure real ip bypass cloudflare',
        'open redirect host header injection cloudflare',
    ],
    'Shopify': [
        'information disclosure shopify api key secret exposure',
        'insecure direct object reference idor shopify storefront',
    ],
    'phpMyAdmin': [
        'sql injection sqli phpmyadmin database admin panel exposed',
        'authentication bypass phpmyadmin default credentials brute force',
        'remote code execution rce phpmyadmin sql query execution',
    ],
    'Adminer': [
        'information disclosure adminer database admin exposed',
        'sql injection sqli adminer database panel brute force',
    ],
    'Wix': [
        'information disclosure wix api key exposed',
        'cross site scripting xss wix embedded widget',
    ],
    'TYPO3': [
        'remote code execution rce typo3 extension',
        'sql injection sqli typo3 database query',
        'authentication bypass typo3 admin credentials',
    ],
}

# ──────────────────────────────────────────────
# WAF / CDN Signatures
# ──────────────────────────────────────────────
WAF_SIGNATURES = {
    'Cloudflare':  [('h','cf-ray'),('h','cf-cache-status'),('c','__cfduid'),('c','cf_clearance')],
    'AWS WAF':     [('h','x-amzn-requestid'),('h','x-amz-cf-id'),('h','x-cache')],
    'Akamai':      [('h','x-akamai-transformed'),('h','x-check-cacheable'),('h','x-akamai-ssl')],
    'Imperva':     [('c','incap_ses'),('c','visid_incap'),('h','x-iinfo')],
    'ModSecurity': [('h','x-modsecurity'),('b','mod_security'),('b','modsecurity')],
    'Sucuri':      [('h','x-sucuri-id'),('h','x-sucuri-cache')],
    'F5 BIG-IP':   [('c','bigipserver'),('h','x-cnection'),('h','x-wa-info')],
    'Wordfence':   [('b','wordfence'),('h','x-wordfence-blocked')],
    'Fortinet':    [('h','fortigate'),('c','fgcsrftoken')],
    'PerimeterX':  [('h','x-px-vid'),('c','_px2'),('c','_px3')],
}

# Patterns for secrets exposed in JS files
JS_SECRET_PATTERNS = [
    (r'(?:api[_-]?key|apikey)\s*[:=]\s*["\']([A-Za-z0-9_\-]{20,})["\']', 'API Key'),
    (r'AKIA[0-9A-Z]{16}', 'AWS Access Key'),
    (r'(?:secret[_-]?key|secret_access_key)\s*[:=]\s*["\']([A-Za-z0-9_\-/+]{20,})["\']', 'Secret Key'),
    (r'-----BEGIN (?:RSA |EC |)PRIVATE KEY-----', 'Private Key'),
    (r'(?:password|passwd)\s*[:=]\s*["\']([^"\'\\]{6,})["\']', 'Hardcoded Password'),
    (r'(?:token|auth[_-]?token|access[_-]?token)\s*[:=]\s*["\']([A-Za-z0-9_\-\.]{20,})["\']', 'Auth Token'),
    (r'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}', 'JWT Token'),
    (r'(?:database[_-]?url|db[_-]?url|mongo(?:db)?[_-]?uri)\s*[:=]\s*["\']([^"\']+)["\']', 'Database URL'),
    (r'(?:stripe)[_\-]?(?:secret|live|test)[_\-]?key\s*[:=]\s*["\']([A-Za-z0-9_\-]{20,})["\']', 'Stripe Key'),
    (r'(?:sendgrid|mailgun|twilio)[_\-]?(?:api[_-]?key|key|token)\s*[:=]\s*["\']([A-Za-z0-9_\-]{20,})["\']', 'Email API Key'),
    (r'/api/v[0-9]+/[a-zA-Z0-9/_-]{3,}', 'API Endpoint'),
    (r'(?:client[_-]?id)\s*[:=]\s*["\']([A-Za-z0-9_\-]{10,})["\']', 'OAuth Client ID'),
]

# Ports to check with their vuln context
COMMON_PORTS = {
    21:    ('ftp',           'information disclosure ftp service exposed file transfer brute force'),
    22:    ('ssh',           'information disclosure ssh service exposed brute force credential'),
    23:    ('telnet',        'information disclosure telnet plaintext credentials exposed'),
    25:    ('smtp',          'information disclosure smtp email service exposed'),
    3306:  ('mysql',         'information disclosure mysql database exposed sql injection'),
    5432:  ('postgresql',    'information disclosure postgresql database exposed sql injection'),
    6379:  ('redis',         'information disclosure redis database unauthenticated access'),
    8080:  ('http-alt',      'information disclosure alternative http admin panel exposed'),
    8443:  ('https-alt',     'information disclosure alternative https admin panel'),
    8000:  ('dev-server',    'information disclosure development server exposed rce'),
    9200:  ('elasticsearch', 'information disclosure elasticsearch unauthenticated access data exposure'),
    5601:  ('kibana',        'information disclosure kibana dashboard exposed'),
    27017: ('mongodb',       'information disclosure mongodb unauthenticated access nosql injection'),
    4848:  ('glassfish',     'information disclosure glassfish admin console exposed rce'),
    2181:  ('zookeeper',     'information disclosure zookeeper service exposed'),
    11211: ('memcached',     'information disclosure memcached unauthenticated access'),
    9090:  ('prometheus',    'information disclosure prometheus metrics endpoint exposed'),
    3000:  ('node-dev',      'information disclosure node.js development server exposed'),
    5000:  ('flask-dev',     'information disclosure flask development server exposed rce'),
    4200:  ('angular-dev',   'information disclosure angular dev server exposed'),
}

TECH_CVE_KEYWORDS = {
    'Apache': ['apache http server', 'httpd', 'apache'],
    'Nginx': ['nginx'],
    'IIS': ['internet information services', 'microsoft iis', 'iis'],
    'Tomcat': ['apache tomcat', 'tomcat'],
    'PHP': ['php'],
    'ASP.NET': ['asp.net', 'aspnet'],
    'WordPress': ['wordpress'],
    'Joomla': ['joomla'],
    'Drupal': ['drupal'],
    'Magento': ['magento'],
    'Laravel': ['laravel'],
    'Django': ['django'],
    'Flask': ['flask', 'werkzeug'],
    'Node.js': ['node.js', 'nodejs', 'express'],
    'React': ['react', 'next.js', 'nextjs'],
    'Next.js': ['next.js', 'nextjs'],
    'Vue.js': ['vue.js', 'vuejs', 'vue'],
    'Angular': ['angular', 'angularjs'],
    'jQuery': ['jquery'],
    'Bootstrap': ['bootstrap'],
    'Shopify': ['shopify'],
    'PrestaShop': ['prestashop'],
    'OpenCart': ['opencart'],
    'TYPO3': ['typo3'],
    'phpMyAdmin': ['phpmyadmin'],
    'Adminer': ['adminer'],
}

# Missing header → vulnerability domain language
# NOTE: Keep neutral — avoid repeating XSS keywords for every missing header
# or it biases every prediction toward XSS regardless of actual page content.
MISSING_HEADER_VULN_MAP = {
    'Content-Security-Policy': 'content security policy header absent',
    'X-Frame-Options': 'x frame options header absent',
    'Strict-Transport-Security': 'strict transport security header absent',
    'X-Content-Type-Options': 'x content type options header absent',
    'X-XSS-Protection': 'x xss protection header absent',
    'Referrer-Policy': 'referrer policy header absent',
    'Permissions-Policy': 'permissions policy header absent',
}

# High-risk keyword patterns to scan in page body
VULN_KEYWORD_PATTERNS = {
    'sqli': re.compile(
        r'(sql\s*syntax|mysql_|mysqli_|pg_query|SELECT\s+.*\s+FROM|'
        r'INSERT\s+INTO|UNION\s+SELECT|syntax\s+error.*sql|'
        r'ORA-\d{5}|microsoft\s+ole\s+db|odbc\s+sql|'
        r'postgresql.*error|sqlite.*error|db_query|'
        r'\?id=|\?user=|\?page=|\?cat=)', re.I),
    'xss': re.compile(
        r'(<script|javascript:|onerror\s*=|onload\s*=|onclick\s*=|'
        r'onmouseover\s*=|document\.cookie|document\.write|'
        r'innerHTML|eval\(|alert\(|prompt\(|'
        r'\{\{.*\}\}|\$\{.*\})', re.I),
    'rce': re.compile(
        r'(exec\(|system\(|passthru\(|shell_exec\(|'
        r'popen\(|proc_open\(|eval\(|assert\(|'
        r'Runtime\.getRuntime|ProcessBuilder|'
        r'subprocess|os\.system|os\.popen|'
        r'child_process|spawn\()', re.I),
    'lfi': re.compile(
        r'(include\(|require\(|include_once\(|require_once\(|'
        r'file_get_contents|fopen\(|readfile\(|'
        r'\.\.[\\/]|etc/passwd|/proc/self|'
        r'php://filter|php://input)', re.I),
    'ssrf': re.compile(
        r'(url=|redirect=|next=|dest=|uri=|'
        r'path=|go=|return=|returnTo=|'
        r'callback=|proxy=|forward=)', re.I),
    'csrf': re.compile(
        r'(<form[^>]*method\s*=\s*["\']?post|'
        r'action\s*=|csrf|_token|authenticity_token)', re.I),
    'idor': re.compile(
        r'(user_id=|account_id=|profile_id=|order_id=|'
        r'invoice_id=|document_id=|file_id=)', re.I),
    'info_disclosure': re.compile(
        r'(stack\s*trace|traceback|debug\s*mode|'
        r'internal\s+server\s+error|exception\s+in|'
        r'error\s+in\s+|phpinfo|server\s+at\s+|'
        r'powered\s+by|version\s+\d)', re.I),
}


# ──────────────────────────────────────────────
# Category keyword patterns (mirrors preprocess_data.py v3.0 CATEGORY_KEYWORDS)
# Used to compute cat_score_* features that the model was trained on.
# ──────────────────────────────────────────────
_CAT_PATTERNS_RAW = {
    'xss':              [r'\bxss\b', r'cross.?site.?script', r'<script[\s>]', r'\balert\s*\(', r'\bonerror\s*=',
                         r'javascript:\s*alert', r'reflected\s+xss', r'stored\s+xss', r'dom.?based\s+xss', r'blind\s+xss', r'self.?xss'],
    'sqli':             [r'\bsql\s*injection\b', r'\bsqli\b', r'\bunion\s+select\b', r'blind\s+sql',
                         r"'\s*or\s*1\s*=\s*1", r'\bsqlmap\b', r'error.based\s+sql', r'time.based\s+sql'],
    'ssrf':             [r'\bssrf\b', r'server.?side\s+request\s+forg', r'169\.254\.169\.254',
                         r'metadata\s+endpoint', r'cloud\s+metadata', r'blind\s+ssrf'],
    'idor':             [r'\bidor\b', r'insecure\s+direct\s+object', r'broken\s+access\s+control',
                         r'horizontal\s+privilege', r'vertical\s+privilege', r'\bbola\b', r'broken\s+object\s+level'],
    'rce':              [r'\brce\b', r'remote\s+code\s+exec', r'command\s+injection', r'os\s+command\s+injection',
                         r'reverse\s+shell', r'arbitrary\s+code', r'shell\s+injection', r'path\s+traversal',
                         r'directory\s+traversal', r'file\s+inclusion', r'\blfi\b', r'\brfi\b',
                         r'\bxxe\b', r'xml\s+external\s+entity', r'deserialization', r'file\s+upload.*exec'],
    'csrf':             [r'\bcsrf\b', r'cross.?site\s+request\s+forg', r'anti.?csrf', r'request\s+forgery'],
    'open_redirect':    [r'open\s+redirect', r'url\s+redirect', r'unvalidated\s+redirect', r'host\s+header\s+injection'],
    'info_disclosure':  [r'information\s+disclosure', r'sensitive\s+data\s+expos', r'api\s+key\s+exposed',
                         r'directory\s+listing', r'source\s+code\s+disclosure', r'stack\s+trace',
    ],
}

def _extract_version(tech, header_str, meta_generator, body, script_srcs):
    """
    Generic, greedy version extractor that searches for version numbers 
    next to a technology name in all available contexts.
    """
    patterns = [
        rf'{re.escape(tech)}[\/\s\-]*v?([\d\.]+)',  # Generic: Tech/1.2 or Tech v1.2
        rf'{re.escape(tech)}:?\s*([\d\.]+)',        # Header style: Tech: 1.2
        rf'v?([\d\.]+).*{re.escape(tech)}',         # Reversed: v1.2 Tech
    ]
    
    # Priority 1: Meta Generator (High Accuracy)
    if meta_generator and tech.lower() in meta_generator.lower():
        v_match = re.search(rf'{re.escape(tech)}[\/\s\-]*([\d\.]+)', meta_generator, re.I)
        if v_match: return v_match.group(1)

    # Priority 2: Headers (High Accuracy for Servers/Languages)
    for p in patterns:
        v_match = re.search(p, header_str, re.I)
        if v_match: return v_match.group(1)

    # Priority 3: Script Sources (High Accuracy for JS Libs)
    if script_srcs:
        v_match = re.search(rf'{re.escape(tech)}[\.\-\/]?([\d\.]+)', script_srcs, re.I)
        if v_match: return v_match.group(1)

    # Priority 4: Body Content (Lower Accuracy - check snippet only)
    v_match = re.search(rf'{re.escape(tech)}[\/\s\-]*v?([\d\.]+)', body[:2000], re.I)
    if v_match: return v_match.group(1)

    return ""

_TECH_CACHE = {} # Global cache for fingerprint results

def _detect_tech_stack(resp_headers, body, cookie_str) -> tuple[list, str]:
    """
    Ultimate Tech Detection with Universal Version Fingerprinting and Caching.
    """
    # Use a simple hash of the body snippet and headers to cache results
    body_hash = hash(body[:5000])
    if body_hash in _TECH_CACHE:
        return _TECH_CACHE[body_hash]

    detected = set()
    header_str = ' '.join(f"{k}: {v}" for k, v in resp_headers.items()).lower()
    cookie_str = str(resp_headers.get('set-cookie', '')).lower()
    
    # Extract <meta name="generator" content="..."> specifically
    meta_generator = ''
    mg = re.search(
        r'<meta[^>]*name\s*=\s*["\']generator["\'][^>]*content\s*=\s*["\']([^"\']+)["\']',
        body[:5000], re.I
    ) or re.search(
        r'<meta[^>]*content\s*=\s*["\']([^"\']+)["\'][^>]*name\s*=\s*["\']generator["\']',
        body[:5000], re.I
    )
    if mg:
        meta_generator = mg.group(1).strip()

    # Collect all <script src="..."> values into one string for bulk matching
    script_srcs = ' '.join(re.findall(r'<script[^>]+src\s*=\s*["\']([^"\']+)["\']', body[:10000], re.I))

    for tech, fp in TECH_FINGERPRINTS.items():
        found = False
        if fp['header'] and fp['header'].search(header_str): found = True
        elif fp['body'] and fp['body'].search(body[:10000]): found = True
        elif fp['cookie'] and cookie_str and fp['cookie'].search(cookie_str): found = True
        elif fp['meta'] and meta_generator and fp['meta'].search(meta_generator): found = True
        elif fp['script'] and script_srcs and fp['script'].search(script_srcs): found = True

        if found:
            # UNIVERSAL VERSION EXTRACTION
            version = _extract_version(tech, header_str, meta_generator, body, script_srcs)
            
            if version:
                detected.add(f"{tech}:{version}")
            else:
                detected.add(tech)

    return sorted(list(detected)), meta_generator


async def _probe_paths(client, base_url: str) -> dict:
    """
    Probe common paths in parallel for tech detection and vulnerability discovery.
    Returns dict: exposed_paths, new_techs, vuln_signals, robots_disallowed.
    """
    parsed = urlparse(base_url)
    base = f"{parsed.scheme}://{parsed.netloc}"

    findings = {
        'exposed_paths': [],
        'new_techs': set(),
        'vuln_signals': [],
        'robots_disallowed': [],
    }

    async def _probe_path(path, tech_hint, vuln_text, get_body):
        try:
            r = await client.head(f"{base}{path}", timeout=httpx.Timeout(5.0))
            # Only treat a path as exposed when it responds successfully or is access controlled.
            if r.status_code in (200, 401, 403):
                body_snippet = ''
                if get_body:
                    try:
                        rb = await client.get(f"{base}{path}", timeout=httpx.Timeout(5.0))
                        if rb.status_code in (200, 401, 403):
                            body_snippet = rb.text[:4000]
                    except Exception:
                        pass
                return path, r.status_code, tech_hint, vuln_text, body_snippet
        except Exception:
            pass
        return None

    results = await asyncio.gather(
        *[_probe_path(p, t, v, g) for p, t, v, g in PROBE_PATHS],
        return_exceptions=True
    )

    for i, result in enumerate(results):
        if not result or isinstance(result, Exception):
            continue
        path, status_code, tech_hint, vuln_text, body_snippet = result

        if tech_hint:
            findings['new_techs'].add(tech_hint)
        findings['exposed_paths'].append({'path': path, 'status': status_code})

        if body_snippet:
            body_techs, _ = _detect_tech_stack({}, body_snippet, '')
            findings['new_techs'].update(body_techs)

        # Keep probe evidence neutral so the classifier is not pre-biased.
        if vuln_text and status_code == 200:
            findings['vuln_signals'].append(f"probe evidence {path}")

        # Extra: parse robots.txt — reuse already-fetched body_snippet (no extra GET)
        if path == '/robots.txt' and status_code == 200 and body_snippet:
            disallowed = re.findall(r'Disallow:\s*(\S+)', body_snippet, re.I)
            sensitive = [p for p in disallowed if re.search(
                r'admin|api|config|backup|db|test|dev|private|secret|upload|cgi',
                p, re.I
            )][:8]
            findings['robots_disallowed'] = sensitive
            if sensitive:
                findings['vuln_signals'].append(
                    f"robots disallow paths {' '.join(sensitive[:3])}"
                )

    findings['new_techs'] = sorted(findings['new_techs'])
    return findings


async def _fingerprint_error_page(client, base_url: str) -> str | None:
    """Hit a random 404 path and fingerprint the error page to detect hidden framework."""
    parsed = urlparse(base_url)
    probe_url = f"{parsed.scheme}://{parsed.netloc}/{uuid.uuid4().hex}"
    try:
        r = await client.get(probe_url, timeout=httpx.Timeout(5.0))
        snippet = r.text[:3000]
        for pattern, tech in _ERROR_PAGE_PATTERNS:
            if re.search(pattern, snippet, re.I):
                return tech
    except Exception:
        pass
    return None


def _extract_body_features(body_text: str, params: dict = None) -> dict:
    """
    Extract rich features from the HTML body for model prediction.
    Returns a dict of extracted elements.
    """
    features = {
        'title': '',
        'meta_descriptions': [],
        'forms': [],
        'inputs': [],
        'scripts': [],
        'comments': [],
        'error_signals': [],
        'vuln_keyword_hits': {},
    }
    params = params or {}

    if not body_text:
        return features

    # Page title
    title_m = re.search(r'<title>(.*?)</title>', body_text, re.I | re.S)
    if title_m:
        features['title'] = title_m.group(1).strip()

    # Meta descriptions & keywords
    for m in re.finditer(
        r'<meta[^>]*(?:name|property)\s*=\s*["\']([^"\']+)["\'][^>]*'
        r'content\s*=\s*["\']([^"\']*)["\']',
        body_text, re.I
    ):
        features['meta_descriptions'].append(f"{m.group(1)} {m.group(2)}")

    # Forms with their action & method
    for m in re.finditer(
        r'<form([^>]*)>(.*?)</form>', body_text, re.I | re.S
    ):
        attrs = m.group(1)
        form_body = m.group(2)
        action_m = re.search(r'action\s*=\s*["\']([^"\']*)["\']', attrs, re.I)
        method_m = re.search(r'method\s*=\s*["\']([^"\']*)["\']', attrs, re.I)
        action = action_m.group(1) if action_m else ''
        method = method_m.group(1) if method_m else 'get'
        features['forms'].append(f"form method {method} action {action}")

        # Check form for CSRF token
        has_csrf = bool(re.search(
            r'csrf|_token|authenticity_token', form_body, re.I
        ))
        if not has_csrf and method.lower() == 'post':
            features['forms'].append(
                'post form without csrf token cross site request forgery'
            )

    # Input fields with context analysis
    for m in re.finditer(r'<input([^>]*)/?>', body_text, re.I):
        attrs = m.group(1)
        type_m = re.search(r'type\s*=\s*["\']([^"\']*)["\']', attrs, re.I)
        name_m = re.search(r'name\s*=\s*["\']([^"\']*)["\']', attrs, re.I)
        inp_type = (type_m.group(1) if type_m else 'text').lower()
        inp_name = (name_m.group(1) if name_m else '').lower()
        
        features['inputs'].append(f"input type {inp_type} name {inp_name}")
        
        # Context Check: Is this a hidden field or a sensitive one?
        if inp_type == 'hidden':
            features['inputs'].append(f"hidden input field {inp_name} potential idor manipulation")
        
        # Check if URL parameters are reflected in the input value (High Signal for XSS)
        for param_name in params.keys():
            if f'value="{param_name}"' in attrs.lower() or f"value='{param_name}'" in attrs.lower():
                 features['vuln_keyword_hits']['xss'] = features['vuln_keyword_hits'].get('xss', 0) + 1
                 features['error_signals'].append(f"parameter {param_name} reflected in input value context")

        # Flag sensitive input names
        if re.search(
            r'password|passwd|secret|token|key|credit|card|ssn|cvv',
            inp_name, re.I
        ):
            features['inputs'].append(
                f"sensitive input field {inp_name} information disclosure"
            )

    # Textareas
    for m in re.finditer(
        r'<textarea([^>]*)>', body_text, re.I
    ):
        attrs = m.group(1)
        name_m = re.search(r'name\s*=\s*["\']([^"\']*)["\']', attrs, re.I)
        n = name_m.group(1) if name_m else ''
        features['inputs'].append(
            f"textarea name {n} user input field rich text area"
        )

    # Select fields
    for m in re.finditer(r'<select([^>]*)>', body_text, re.I):
        attrs = m.group(1)
        name_m = re.search(r'name\s*=\s*["\']([^"\']*)["\']', attrs, re.I)
        n = name_m.group(1) if name_m else ''
        features['inputs'].append(f"select name {n}")

    # JavaScript src references
    for m in re.finditer(
        r'<script[^>]*src\s*=\s*["\']([^"\']+)["\']', body_text, re.I
    ):
        src = m.group(1)
        features['scripts'].append(f"external script {src}")

    # Inline JavaScript blocks (Deep Analysis for Sinks)
    inline_scripts = re.findall(
        r'<script[^>]*>(.*?)</script>', body_text, re.I | re.S
    )
    for s in inline_scripts[:8]:
        snippet = s.strip()
        if not snippet: continue
        
        # Look for dangerous sinks that consume URL parameters
        sinks = [r'innerHTML', r'document\.write\(', r'eval\(', r'setTimeout\(', r'location\.href']
        for sink in sinks:
            if re.search(sink, snippet):
                # If a sink is near a URL parameter reference, it's a huge XSS signal
                if any(p in snippet for p in params.keys()):
                    features['error_signals'].append(f"dangerous js sink {sink} with url parameter reflection")
                    features['vuln_keyword_hits']['xss'] = features['vuln_keyword_hits'].get('xss', 0) + 2
        
        features['scripts'].append(f"inline script {snippet[:200]}")

    # HTML comments (may leak info)
    for m in re.finditer(r'<!--(.*?)-->', body_text, re.I | re.S):
        comment = m.group(1).strip()[:150]
        if comment and len(comment) > 3:
            features['comments'].append(comment)
            # Flag comments with sensitive words
            if re.search(
                r'todo|fixme|hack|bug|password|secret|key|token|'
                r'debug|admin|root|config|api_key|credential',
                comment, re.I
            ):
                features['error_signals'].append(
                    f"sensitive comment information disclosure {comment[:80]}"
                )

    # Error messages & debug info
    error_patterns = [
        (r'(?:fatal\s+error|parse\s+error|warning).*?(?:in|on)\s+.*?\.php',
         'php error information disclosure stack trace'),
        (r'Traceback\s*\(most\s+recent\s+call\s+last\)',
         'python traceback information disclosure'),
        (r'Exception\s+in\s+thread|java\.lang\.',
         'java exception information disclosure'),
        (r'Microsoft\s+OLE\s+DB|ODBC\s+SQL\s+Server',
         'database error sql injection sqli'),
        (r'mysql_fetch|mysql_num_rows|mysql_connect',
         'mysql error sql injection sqli database'),
        (r'pg_query|pg_exec|pg_connect',
         'postgresql error sql injection sqli database'),
        (r'Internal\s+Server\s+Error',
         'internal server error misconfiguration'),
        (r'Access\s+denied\s+for\s+user',
         'access denied database credential exposure'),
    ]
    for pattern, label in error_patterns:
        if re.search(pattern, body_text, re.I):
            features['error_signals'].append(label)

    # Scan for vulnerability keyword hits
    for vuln_type, pattern in VULN_KEYWORD_PATTERNS.items():
        matches = pattern.findall(body_text[:8000])
        if matches:
            features['vuln_keyword_hits'][vuln_type] = len(matches)

    return features


def _build_neutral_scan_text(
    url: str,
    scan_info: dict,
    body_features: dict,
    body_text: str,
    probe_findings: dict,
    meta_generator: str,
    cve_matches: list[dict],
) -> str:
    """Build neutral evidence text for the passive classifier."""
    parts = [
        f"target url {url}",
        f"http status {scan_info.get('status_code', '')}",
        f"server signature {scan_info.get('server_info', '')}",
    ]

    if scan_info.get('tech_stack'):
        parts.append(f"detected technologies {' '.join(scan_info['tech_stack'])}")
    if meta_generator:
        parts.append(f"meta generator {meta_generator}")

    parsed = urlparse(url)
    if parsed.path:
        parts.append(f"url path {parsed.path}")
    if parsed.query:
        parts.append(f"url query {parsed.query}")

    for mh in scan_info.get('missing_headers', []):
        parts.append(f"missing header {MISSING_HEADER_VULN_MAP.get(mh, mh.lower())}")

    for exposed in scan_info.get('exposed_paths', [])[:10]:
        parts.append(f"exposed path {exposed['path']} status {exposed['status']}")

    if scan_info.get('robots_disallowed'):
        parts.append(f"robots disallow {' '.join(scan_info['robots_disallowed'][:8])}")

    for match in cve_matches[:5]:
        parts.append(
            f"cve lookup match {match['cve_id']} tech {match['tech']} category {match.get('category', '')} match {match.get('match_type', 'tech')}"
        )

    if body_features.get('title'):
        parts.append(f"page title {body_features['title']}")
    for desc in body_features.get('meta_descriptions', [])[:5]:
        parts.append(f"meta description {desc}")
    for form_info in body_features.get('forms', [])[:12]:
        parts.append(form_info)
    for inp in body_features.get('inputs', [])[:20]:
        parts.append(inp)
    for script in body_features.get('scripts', [])[:12]:
        parts.append(script)
    for comment in body_features.get('comments', [])[:10]:
        parts.append(f"html comment {comment}")
    for err in body_features.get('error_signals', [])[:10]:
        parts.append(err)
    for vtype, count in sorted(body_features.get('vuln_keyword_hits', {}).items()):
        parts.append(f"keyword signal {vtype} count {count}")
    for vsig in probe_findings.get('vuln_signals', [])[:10]:
        parts.append(vsig)

    if body_text:
        parts.append(body_text[:12000])

    return ' '.join(part for part in parts if part).lower()


def _extract_url_features(url: str) -> list:
    """
    Extract vulnerability-relevant features from the URL itself.
    """
    parts = []
    parsed = urlparse(url)

    # URL path analysis
    path = parsed.path.lower()
    if path:
        parts.append(f"url path {path}")

        # Common vulnerable path patterns
        vuln_paths = {
            r'/admin': 'admin panel access control',
            r'/login': 'authentication login brute force',
            r'/upload': 'file upload unrestricted',
            r'/api/': 'api endpoint injection',
            r'/search': 'dynamic search parameter potential xss injection point',
            r'/redirect': 'open redirect unvalidated',
            r'/download': 'file download path traversal',
            r'/include': 'file inclusion lfi rfi',
            r'/exec': 'command execution rce',
            r'/debug': 'debug information disclosure',
            r'/config': 'configuration exposure information disclosure',
            r'/backup': 'backup file information disclosure',
            r'\.php': 'php application sql injection rce file inclusion',
            r'\.asp': 'asp application sql injection',
            r'\.jsp': 'java server page potential injection point',
            r'\.cgi': 'cgi application command injection rce',
        }
        for vp_pattern, vp_label in vuln_paths.items():
            if re.search(vp_pattern, path, re.I):
                parts.append(vp_label)

    # Query parameter analysis
    params = parse_qs(parsed.query)
    if params:
        param_names = list(params.keys())
        parts.append(f"url parameters {' '.join(param_names)}")

        # Flag potentially injectable parameters
        for pname in param_names:
            pname_lower = pname.lower()
            if re.search(r'id|user|name|search|query|q|page|file|path|url|redirect|callback|ref|sort|order|filter|cat|type|action|cmd|exec|lang|template|include', pname_lower):
                parts.append(
                    f"injectable parameter {pname} user controlled input"
                )
            # Check parameter values for patterns
            for val in params[pname]:
                if re.search(r'^\d+$', val):
                    parts.append(
                        f"numeric parameter {pname} idor sql injection"
                    )
                elif re.search(r'https?://', val):
                    parts.append(
                        f"url in parameter {pname} ssrf open redirect"
                    )
                elif re.search(r'[<>"\']', val):
                    parts.append(
                        f"special chars in parameter {pname} cross site scripting xss"
                    )

    return parts


def _build_vulnerability_reasons(
    scan_info: dict, body_features: dict, url: str
) -> dict:
    """
    Build evidence-based reasons for each vulnerability type.
    Returns a dict mapping vulnerability name -> list of reason strings.
    """
    from urllib.parse import urlparse, parse_qs as _pqs
    parsed = urlparse(url)
    params = _pqs(parsed.query)
    path = parsed.path.lower()

    reasons = {}

    # ── XSS reasons ──
    xss_reasons = []
    if 'Content-Security-Policy' in scan_info['missing_headers']:
        xss_reasons.append('Content-Security-Policy header is missing — no protection against inline script injection')
    if 'X-XSS-Protection' in scan_info['missing_headers']:
        xss_reasons.append('X-XSS-Protection header is missing — browser XSS filter not enforced')
    if body_features.get('vuln_keyword_hits', {}).get('xss'):
        xss_reasons.append(f"Found {body_features['vuln_keyword_hits']['xss']} XSS-related patterns in page body (e.g., <script>, event handlers, eval())")
    input_count = len(body_features.get('inputs', []))
    if input_count > 0:
        xss_reasons.append(f'Page has {input_count} input fields that could accept user input for reflected/stored XSS')
    textarea_found = any('textarea' in inp for inp in body_features.get('inputs', []))
    if textarea_found:
        xss_reasons.append('Textarea elements found — rich user input areas are common XSS vectors')
    if any(re.search(r'search|query|q=', p, re.I) for p in params):
        xss_reasons.append('URL contains search/query parameters — reflected XSS is common in search functionality')
    if '/search' in path:
        xss_reasons.append('URL path contains /search — search pages often reflect user input')
    if xss_reasons:
        reasons['XSS'] = xss_reasons

    # ── SQLI reasons ──
    sqli_reasons = []
    if body_features.get('vuln_keyword_hits', {}).get('sqli'):
        sqli_reasons.append(f"Found {body_features['vuln_keyword_hits']['sqli']} SQL-related patterns in page body (e.g., SQL keywords, database errors)")
    numeric_params = [p for p in params if any(v.isdigit() for v in params[p])]
    if numeric_params:
        sqli_reasons.append(f"URL has numeric parameters ({', '.join(numeric_params)}) — common SQL injection entry points")
    if any(re.search(r'id|user|page|cat|item|product|article', p, re.I) for p in params):
        sqli_reasons.append('URL parameters suggest database lookups (id, user, page, etc.)')
    if any(t in scan_info['tech_stack'] for t in ['PHP', 'ASP.NET', 'IIS']):
        sqli_reasons.append(f"Tech stack ({', '.join(scan_info['tech_stack'])}) is commonly associated with SQL injection vulnerabilities")
    for err in body_features.get('error_signals', []):
        if 'sql' in err.lower() or 'database' in err.lower():
            sqli_reasons.append(f'Database error signal detected: {err}')
    if any('.php' in path for _ in [1]):
        sqli_reasons.append('PHP file detected in URL path — PHP apps are frequent SQL injection targets')
    if sqli_reasons:
        reasons['SQLI'] = sqli_reasons

    # ── CSRF reasons ──
    csrf_reasons = []
    if body_features.get('vuln_keyword_hits', {}).get('csrf'):
        csrf_reasons.append(f"Found {body_features['vuln_keyword_hits']['csrf']} form/CSRF-related patterns in page body")
    forms_without_csrf = [f for f in body_features.get('forms', []) if 'without csrf' in f]
    if forms_without_csrf:
        csrf_reasons.append(f'{len(forms_without_csrf)} POST form(s) found without CSRF token protection')
    post_forms = [f for f in body_features.get('forms', []) if 'method post' in f.lower()]
    if post_forms and not forms_without_csrf:
        csrf_reasons.append(f'{len(post_forms)} POST form(s) found — verify CSRF token implementation')
    if csrf_reasons:
        reasons['CSRF'] = csrf_reasons

    # ── RCE reasons ──
    rce_reasons = []
    if body_features.get('vuln_keyword_hits', {}).get('rce'):
        rce_reasons.append(f"Found {body_features['vuln_keyword_hits']['rce']} code execution patterns in page body (e.g., exec(), system(), eval())")
    if any(t in scan_info['tech_stack'] for t in ['PHP', 'Apache']):
        rce_reasons.append(f"Server technology ({', '.join(scan_info['tech_stack'])}) supports server-side code execution")
    if re.search(r'\.(php|cgi|pl|py|rb|jsp|asp)$', path, re.I):
        rce_reasons.append('Dynamic server-side script detected in URL — potential code execution surface')
    if any(re.search(r'cmd|exec|run|command', p, re.I) for p in params):
        rce_reasons.append('URL parameters suggest command execution functionality')
    for err in body_features.get('error_signals', []):
        if 'traceback' in err.lower() or 'exception' in err.lower():
            rce_reasons.append(f'Server-side error leakage detected: {err}')
    if rce_reasons:
        reasons['RCE'] = rce_reasons

    # ── LFI/Path Traversal reasons ──
    lfi_reasons = []
    if body_features.get('vuln_keyword_hits', {}).get('lfi'):
        lfi_reasons.append(f"Found {body_features['vuln_keyword_hits']['lfi']} file inclusion patterns in page body")
    if any(re.search(r'file|path|include|page|template|lang|doc', p, re.I) for p in params):
        lfi_reasons.append('URL parameters suggest file path handling (file, path, include, template, etc.)')
    if '/include' in path or '/download' in path:
        lfi_reasons.append('URL path suggests file inclusion or download functionality')
    if 'PHP' in scan_info['tech_stack']:
        lfi_reasons.append('PHP detected — PHP is commonly vulnerable to local/remote file inclusion')
    if lfi_reasons:
        reasons['LFI'] = lfi_reasons

    # ── SSRF reasons ──
    ssrf_reasons = []
    if body_features.get('vuln_keyword_hits', {}).get('ssrf'):
        ssrf_reasons.append(f"Found {body_features['vuln_keyword_hits']['ssrf']} URL/redirect-related parameters in page")
    url_in_params = [p for p in params if any(re.search(r'https?://', v) for v in params[p])]
    if url_in_params:
        ssrf_reasons.append(f"Parameters ({', '.join(url_in_params)}) contain URLs — potential SSRF vector")
    if any(re.search(r'url|redirect|callback|proxy|forward|dest|next|return', p, re.I) for p in params):
        ssrf_reasons.append('URL parameters suggest server-side URL fetching or redirection')
    if 'AWS' in scan_info['tech_stack']:
        ssrf_reasons.append('AWS infrastructure detected — SSRF can access internal metadata endpoints')
    if ssrf_reasons:
        reasons['SSRF'] = ssrf_reasons

    # ── IDOR reasons ──
    idor_reasons = []
    if body_features.get('vuln_keyword_hits', {}).get('idor'):
        idor_reasons.append(f"Found {body_features['vuln_keyword_hits']['idor']} object reference patterns in page (user_id, account_id, etc.)")
    if numeric_params:
        idor_reasons.append(f"Numeric parameters ({', '.join(numeric_params)}) may reference database objects directly")
    if any(re.search(r'profile|account|order|invoice|user|document', p, re.I) for p in params):
        idor_reasons.append('URL parameters reference user-specific resources — may be accessible by changing IDs')
    if '/api/' in path:
        idor_reasons.append('API endpoint detected — API routes often lack proper authorization checks')
    if idor_reasons:
        reasons['IDOR'] = idor_reasons

    # ── Information Disclosure reasons ──
    info_reasons = []
    if body_features.get('vuln_keyword_hits', {}).get('info_disclosure'):
        info_reasons.append(f"Found {body_features['vuln_keyword_hits']['info_disclosure']} information leakage patterns in page")
    for err in body_features.get('error_signals', []):
        info_reasons.append(f'Sensitive information detected: {err}')
    sensitive_comments = [c for c in body_features.get('comments', [])
                         if re.search(r'todo|password|secret|key|debug|admin|config|api_key', c, re.I)]
    if sensitive_comments:
        info_reasons.append(f'{len(sensitive_comments)} HTML comment(s) contain sensitive keywords (passwords, keys, debug info)')
    if scan_info['server_info']:
        info_reasons.append(f"Server version disclosed: {scan_info['server_info']}")
    if 'Referrer-Policy' in scan_info['missing_headers']:
        info_reasons.append('Referrer-Policy header missing — sensitive URLs may leak via referrer')
    if info_reasons:
        reasons['Information Disclosure'] = info_reasons

    # ── Clickjacking reasons ──
    click_reasons = []
    if 'X-Frame-Options' in scan_info['missing_headers']:
        click_reasons.append('X-Frame-Options header is missing — page can be embedded in iframes for clickjacking')
    if 'Content-Security-Policy' in scan_info['missing_headers']:
        click_reasons.append('No CSP frame-ancestors directive — no iframe embedding restriction')
    if click_reasons:
        reasons['Clickjacking'] = click_reasons

    # ── Open Redirect reasons ──
    redirect_reasons = []
    if any(re.search(r'redirect|return|next|dest|url|goto|forward', p, re.I) for p in params):
        redirect_reasons.append('URL contains redirect/return-type parameters — may allow open redirect')
    url_in_params = [p for p in params if any(re.search(r'https?://', v) for v in params[p])]
    if url_in_params:
        redirect_reasons.append(f"Parameters ({', '.join(url_in_params)}) contain full URLs — open redirect risk")
    if redirect_reasons:
        reasons['Open Redirect'] = redirect_reasons

    return reasons


# ──────────────────────────────────────────────
# Phase 2a — SSL/TLS Analysis
# ──────────────────────────────────────────────

async def _analyze_ssl(hostname: str, port: int = 443) -> dict:
    import ssl, socket, datetime
    result = {
        'enabled': False, 'protocol': '', 'cipher': '',
        'cert_expiry_days': None, 'cert_cn': '', 'san_domains': [],
        'self_signed': False, 'weak_protocol': False, 'issues': [],
    }
    if not hostname:
        return result
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        def _sync_get():
            with socket.create_connection((hostname, port), timeout=5) as sock:
                with ctx.wrap_socket(sock, server_hostname=hostname) as ssock:
                    return ssock.version(), ssock.cipher(), ssock.getpeercert()

        loop = asyncio.get_running_loop()
        version, cipher, cert = await loop.run_in_executor(None, _sync_get)
        result['enabled'] = True
        result['protocol'] = version or ''
        result['cipher'] = cipher[0] if cipher else ''
        if version in ('SSLv2', 'SSLv3', 'TLSv1', 'TLSv1.1'):
            result['weak_protocol'] = True
            result['issues'].append(f'Weak TLS: {version}')
        if cert:
            not_after = cert.get('notAfter', '')
            if not_after:
                try:
                    expiry = datetime.datetime.strptime(not_after, '%b %d %H:%M:%S %Y %Z')
                    days = (expiry - datetime.datetime.utcnow()).days
                    result['cert_expiry_days'] = days
                    if days < 30:
                        result['issues'].append(f'Certificate expires in {days} days')
                except Exception:
                    pass
            subject = dict(x[0] for x in cert.get('subject', []))
            issuer  = dict(x[0] for x in cert.get('issuer', []))
            result['cert_cn'] = subject.get('commonName', '')
            result['self_signed'] = (subject == issuer)
            if result['self_signed']:
                result['issues'].append('Self-signed certificate')
            result['san_domains'] = [v for t, v in cert.get('subjectAltName', []) if t == 'DNS'][:12]
    except Exception:
        pass
    return result


# ──────────────────────────────────────────────
# Phase 2b — WAF / CDN Detection
# ──────────────────────────────────────────────

def _detect_waf(resp_headers: dict, body_text: str, cookie_str: str) -> str | None:
    header_str = ' '.join(f"{k.lower()}: {v.lower()}" for k, v in resp_headers.items())
    body_lower  = body_text[:3000].lower()
    cookie_lower = cookie_str.lower()
    for waf_name, signals in WAF_SIGNATURES.items():
        for src, token in signals:
            t = token.lower()
            if (src == 'h' and t in header_str) or \
               (src == 'c' and t in cookie_lower) or \
               (src == 'b' and t in body_lower):
                return waf_name
    return None


# ──────────────────────────────────────────────
# Phase 2c — JS File Secret Scanner
# ──────────────────────────────────────────────

async def _scan_js_secrets(client: httpx.AsyncClient, body_text: str, base_url: str) -> list:
    findings = []
    seen = set()
    srcs = re.findall(r'<script[^>]+src\s*=\s*["\']([^"\']+)["\']', body_text, re.I)
    parsed_base = urlparse(base_url)
    base = f"{parsed_base.scheme}://{parsed_base.netloc}"
    resolved = []
    for src in srcs[:12]:
        if src.startswith('http'):
            resolved.append(src)
        elif src.startswith('//'):
            resolved.append(f"{parsed_base.scheme}:{src}")
        elif src.startswith('/'):
            resolved.append(f"{base}{src}")

    # Next.js: extract buildId from __NEXT_DATA__ → fetch real _buildManifest to get chunk filenames
    next_data_match = re.search(r'<script[^>]+id=["\']__NEXT_DATA__["\'][^>]*>(\{.*?\})</script>', body_text, re.S)
    if next_data_match:
        try:
            nd = json.loads(next_data_match.group(1))
            build_id = nd.get('buildId', '')
            if build_id:
                manifest_url = f"{base}/_next/static/{build_id}/_buildManifest.js"
                mr = await client.get(manifest_url, timeout=httpx.Timeout(6.0))
                if mr.status_code == 200:
                    chunk_paths = re.findall(r'"(/_next/static/chunks/[^"]+\.js)"', mr.text)
                    resolved.extend([f"{base}{p}" for p in chunk_paths[:8]])
        except Exception:
            pass

    # CRA: /static/js/main.chunk.js (hash already in <script src> so covered above, but probe fallback)
    if not any('/static/js/' in u for u in resolved):
        resolved.append(f"{base}/static/js/main.chunk.js")

    async def _fetch_and_scan(js_url: str):
        try:
            r = await client.get(js_url, timeout=httpx.Timeout(6.0))
            # Retry once on WAF throttle
            if r.status_code in (429, 503):
                await asyncio.sleep(2.0)
                r = await client.get(js_url, timeout=httpx.Timeout(6.0))
            if r.status_code != 200:
                return
            content = r.text[:80000]
            for pattern, label in JS_SECRET_PATTERNS:
                matches = re.findall(pattern, content, re.I)
                if not matches:
                    continue
                key = (label, js_url)
                if key in seen:
                    continue
                seen.add(key)
                sample = matches[0] if isinstance(matches[0], str) else matches[0][0]
                findings.append({
                    'type': label,
                    'file': js_url.split('/')[-1][:60],
                    'sample': str(sample)[:80],
                })
        except Exception:
            pass

    await asyncio.gather(*[_fetch_and_scan(u) for u in resolved[:10]])
    return findings


# ──────────────────────────────────────────────
# Phase 2d — CORS Misconfiguration Check
# ──────────────────────────────────────────────

async def _check_cors(client: httpx.AsyncClient, url: str) -> dict:
    result = {'misconfigured': False, 'allow_origin': '', 'allow_credentials': False, 'details': ''}
    try:
        r = await client.get(url, headers={'Origin': 'https://evil-attacker.com'}, timeout=httpx.Timeout(6.0))
        acao = r.headers.get('access-control-allow-origin', '')
        acac = r.headers.get('access-control-allow-credentials', '').lower() == 'true'
        result.update({'allow_origin': acao, 'allow_credentials': acac})
        if acao == '*':
            result['misconfigured'] = True
            result['details'] = 'CORS allows all origins (*) — any site can read responses'
        elif acao == 'https://evil-attacker.com':
            result['misconfigured'] = True
            creds = ' WITH credentials (critical)' if acac else ''
            result['details'] = f'CORS reflects arbitrary origin{creds} — cross-origin data theft possible'
    except Exception:
        pass
    return result


# ──────────────────────────────────────────────
# Phase 6 — Port Scanner
# ──────────────────────────────────────────────

async def _scan_ports(hostname: str) -> list:
    if not hostname:
        return []
    open_ports = []

    async def _check(port, service, vuln):
        try:
            _, writer = await asyncio.wait_for(asyncio.open_connection(hostname, port), timeout=1.0)
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass
            return {'port': port, 'service': service, 'vuln_signal': vuln}
        except Exception:
            return None

    results = await asyncio.gather(*[_check(p, s, v) for p, (s, v) in COMMON_PORTS.items()], return_exceptions=True)
    for r in results:
        if r and not isinstance(r, Exception):
            open_ports.append(r)
    return open_ports


# ──────────────────────────────────────────────
# Phase 1 — Rule-Based Confidence Override
# ──────────────────────────────────────────────

def _apply_rule_overrides(
    predictions: list, scan_info: dict, body_features: dict,
    url: str, cors_result: dict, ssl_info: dict,
    js_secrets: list, open_ports: list,
) -> list:
    parsed = urlparse(url)
    params  = parse_qs(parsed.query)
    path    = parsed.path.lower()
    missing = set(scan_info.get('missing_headers', []))
    vuln_hits     = body_features.get('vuln_keyword_hits', {})
    forms         = body_features.get('forms', [])
    error_signals = body_features.get('error_signals', [])
    tech          = set(scan_info.get('tech_stack', []))
    exposed_paths = {ep['path'] for ep in scan_info.get('exposed_paths', [])}
    open_port_nums = {p['port'] for p in open_ports}
    boosts = {p['name']: 0.0 for p in predictions}
    reason_map = {p['name']: [] for p in predictions}

    # SQLI
    if vuln_hits.get('sqli', 0) > 0:
        boosts['SQLI'] += 0.30
        reason_map['SQLI'].append("Detected SQL-related keyword signatures in response body")
    if any('sql' in e.lower() or 'database' in e.lower() for e in error_signals):
        boosts['SQLI'] += 0.25
        reason_map['SQLI'].append("Database error or SQL driver signature found in error signals")
    if tech & {'PHP','ASP.NET','IIS'} and any(re.search(r'id|user|page|cat|item|product', p, re.I) for p in params):
        boosts['SQLI'] += 0.10
        reason_map['SQLI'].append(f"Classic injection-prone parameters found on {list(tech)[0]} stack")
    if open_port_nums & {3306, 5432}:
        boosts['SQLI'] += 0.15
        reason_map['SQLI'].append("Common database ports (3306/5432) detected as open")

    # XSS
    if vuln_hits.get('xss', 0) > 0:
        boosts['XSS'] += 0.20
        reason_map['XSS'].append("Detected XSS-related keyword/event-handler signatures")
    if 'Content-Security-Policy' in missing and body_features.get('inputs'):
        boosts['XSS'] += 0.12
        reason_map['XSS'].append("Missing Content-Security-Policy (CSP) on page with user input fields")
    if any(re.search(r'search|query|^q$', p, re.I) for p in params):
        boosts['XSS'] += 0.08
        reason_map['XSS'].append("Search-related URL parameters are highly prone to reflection")
    
    # Check for the new context-aware signals we added
    for signal in error_signals:
        if "reflected in input value" in signal:
            boosts['XSS'] += 0.15
            reason_map['XSS'].append(signal)
        if "dangerous js sink" in signal:
            boosts['XSS'] += 0.25
            reason_map['XSS'].append(signal)

    # CSRF
    if [f for f in forms if 'without csrf' in f.lower()]:
        boosts['CSRF'] += 0.30
        reason_map['CSRF'].append("HTML form detected without anti-CSRF token protection")
    elif any('method post' in f.lower() for f in forms):
        boosts['CSRF'] += 0.10
        reason_map['CSRF'].append("State-changing POST form detected")

    # INFO_DISCLOSURE
    critical_paths = {'/.git/HEAD','/.env','/phpinfo.php','/.htaccess','/web.config','/dump.sql','/backup.zip','/server-status','/actuator/env'}
    if exposed_paths & critical_paths:                                                      boosts['INFO_DISCLOSURE'] += 0.45
    if error_signals:                                                                       boosts['INFO_DISCLOSURE'] += min(0.25, len(error_signals) * 0.08)
    if scan_info.get('server_info',''):                                                     boosts['INFO_DISCLOSURE'] += 0.08
    if js_secrets:                                                                          boosts['INFO_DISCLOSURE'] += min(0.40, len(js_secrets) * 0.14)
    if open_ports:                                                                          boosts['INFO_DISCLOSURE'] += min(0.20, len(open_ports) * 0.05)
    if ssl_info.get('self_signed'):                                                         boosts['INFO_DISCLOSURE'] += 0.08

    # SSRF
    if any(re.search(r'url|redirect|callback|proxy|forward|dest|next|return', p, re.I) for p in params): boosts['SSRF'] += 0.15
    if any(v for vs in params.values() for v in vs if re.search(r'https?://', v)):         boosts['SSRF'] += 0.20
    if tech & {'AWS','Azure','GCP'}:                                                        boosts['SSRF'] += 0.12

    # OPEN_REDIRECT
    if any(re.search(r'redirect|return|next|dest|url|goto|forward', p, re.I) for p in params): boosts['OPEN_REDIRECT'] += 0.15
    if any(v for vs in params.values() for v in vs if re.search(r'https?://', v)):         boosts['OPEN_REDIRECT'] += 0.15

    # AUTH_BYPASS
    if cors_result.get('misconfigured') and cors_result.get('allow_credentials'):          boosts['AUTH_BYPASS'] += 0.30
    if exposed_paths & {'/admin/','/administrator/','/wp-login.php','/user/login'}:         boosts['AUTH_BYPASS'] += 0.20
    if ssl_info.get('weak_protocol'):                                                       boosts['AUTH_BYPASS'] += 0.10

    # IDOR
    if vuln_hits.get('idor', 0) > 0:                                                       boosts['IDOR'] += 0.20
    if any(re.search(r'id|user_id|account_id|order_id|profile_id|doc_id', p, re.I) for p in params) \
       and any(v.isdigit() for vs in params.values() for v in vs):                         boosts['IDOR'] += 0.20
    if '/api/' in path:                                                                     boosts['IDOR'] += 0.08

    # RCE
    if vuln_hits.get('rce', 0) > 0:                                                        boosts['RCE'] += 0.20
    if exposed_paths & {'/h2-console','/console','/adminer.php','/phpinfo.php'}:            boosts['RCE'] += 0.25
    if any('traceback' in e.lower() or 'exception' in e.lower() for e in error_signals):   boosts['RCE'] += 0.10
    if 4848 in open_port_nums:                                                              boosts['RCE'] += 0.20

    result = []
    for pred in predictions:
        boost = boosts.get(pred['name'], 0.0)
        reasons = reason_map.get(pred['name'], [])
        p = dict(pred)
        p['reasons'] = reasons
        if boost > 0:
            new_conf = min(0.95, p['confidence'] + boost * (1.0 - p['confidence']))
            p['confidence']  = round(new_conf, 4)
            p['percentage']  = round(new_conf * 100, 2)
            p['rule_boost']  = round(boost, 3)
            p['risk_level']  = 'high' if new_conf >= 0.55 else ('medium' if new_conf >= 0.25 else 'low')
        result.append(p)
    result.sort(key=lambda x: x['confidence'], reverse=True)
    return result


# ──────────────────────────────────────────────
# Risk Score (0-100)
# ──────────────────────────────────────────────

def _compute_risk_score(predictions: list, severity: dict, open_ports: list, js_secrets: list, exposed_paths: list) -> int:
    sev_w = {'critical': 1.0, 'high': 0.75, 'medium': 0.50, 'low': 0.25}
    score = sum(p['confidence'] * sev_w.get(severity.get('name','medium'), 0.50) * 8.0
                for p in predictions if p['confidence'] > 0.10)
    score  = min(score, 50)
    score += min(len(open_ports) * 5, 20)
    score += min(len(js_secrets) * 8, 16)
    score += min(len(exposed_paths) * 3, 14)
    return min(100, int(score))


# ──────────────────────────────────────────────
# Phase 7 — Clickjacking Check
# ──────────────────────────────────────────────

def _check_clickjacking(resp_headers: dict) -> dict:
    xfo = resp_headers.get('x-frame-options', '').upper()
    csp = resp_headers.get('content-security-policy', '').lower()
    protected = bool(xfo in ('DENY', 'SAMEORIGIN') or 'frame-ancestors' in csp)
    return {
        'vulnerable': not protected,
        'x_frame_options': xfo or None,
        'csp_frame_ancestors': ('frame-ancestors' in csp),
    }


# ──────────────────────────────────────────────
# CSP Quality Checker
# ──────────────────────────────────────────────

def _analyze_csp(resp_headers: dict) -> dict:
    csp = resp_headers.get('content-security-policy', '')
    if not csp:
        return {'present': False, 'quality': 'missing', 'issues': [], 'score': 0}
    csp_lower = csp.lower()
    issues = []
    score  = 10
    if 'unsafe-inline' in csp_lower:
        issues.append("'unsafe-inline' allows inline scripts/styles — XSS protection bypassed")
        score -= 4
    if 'unsafe-eval' in csp_lower:
        issues.append("'unsafe-eval' allows eval() — code injection risk")
        score -= 3
    if re.search(r"default-src\s+'?'?\s*\*|script-src\s+'?\*'?", csp_lower):
        issues.append("Wildcard (*) in script-src or default-src — any origin allowed")
        score -= 4
    if 'default-src' not in csp_lower and 'script-src' not in csp_lower:
        issues.append("No default-src or script-src directive — policy incomplete")
        score -= 2
    if 'http:' in csp_lower:
        issues.append("http: scheme allowed — mixed content and downgrade risk")
        score -= 2
    score = max(0, score)
    quality = 'strong' if score >= 8 else ('weak' if score >= 4 else 'bypassable')
    return {'present': True, 'quality': quality, 'issues': issues, 'score': score, 'value': csp[:200]}


# ──────────────────────────────────────────────
# HTTP Methods Check (OPTIONS/TRACE)
# ──────────────────────────────────────────────

async def _check_http_methods(client: httpx.AsyncClient, url: str) -> dict:
    result = {'allowed_methods': [], 'dangerous': [], 'issues': []}
    try:
        r = await client.options(url, timeout=httpx.Timeout(6.0))
        allow = r.headers.get('allow', '') or r.headers.get('access-control-allow-methods', '')
        if allow:
            methods = [m.strip().upper() for m in allow.split(',')]
            result['allowed_methods'] = methods
            dangerous = [m for m in methods if m in ('TRACE', 'TRACK', 'PUT', 'DELETE', 'CONNECT')]
            result['dangerous'] = dangerous
            if 'TRACE' in dangerous or 'TRACK' in dangerous:
                result['issues'].append('TRACE/TRACK enabled — Cross-Site Tracing (XST) attack possible')
            if 'PUT' in dangerous:
                result['issues'].append('PUT method allowed — may enable arbitrary file upload/overwrite')
            if 'DELETE' in dangerous:
                result['issues'].append('DELETE method allowed — may enable data destruction without auth')
    except Exception:
        pass
    # Explicit TRACE check
    try:
        tr = await client.request('TRACE', url, timeout=httpx.Timeout(5.0))
        if tr.status_code == 200:
            if 'TRACE' not in result['dangerous']:
                result['dangerous'].append('TRACE')
            if not any('TRACE' in i for i in result['issues']):
                result['issues'].append('TRACE method enabled (200 response) — Cross-Site Tracing possible')
    except Exception:
        pass
    return result


# ──────────────────────────────────────────────
# Cookie Security Deep Analysis
# ──────────────────────────────────────────────

def _analyze_cookies(resp_headers: dict, url: str) -> dict:
    result = {'cookies': [], 'issues': []}
    raw = resp_headers.get('set-cookie', '')
    if not raw:
        return result
    is_https = url.startswith('https')
    for cookie_line in raw.split('\n'):
        cookie_line = cookie_line.strip()
        if not cookie_line:
            continue
        low = cookie_line.lower()
        parts = [p.strip() for p in cookie_line.split(';')]
        name  = parts[0].split('=')[0].strip() if parts else 'unknown'
        flags = {p.split('=')[0].strip().lower() for p in parts[1:]}
        samesite_val = next((p.split('=')[1].strip().lower() for p in parts[1:]
                             if p.strip().lower().startswith('samesite=')), None)
        is_session = bool(re.search(r'session|auth|token|jwt|sid|login', name, re.I))
        c = {
            'name': name,
            'httponly': 'httponly' in flags,
            'secure': 'secure' in flags,
            'samesite': samesite_val,
        }
        result['cookies'].append(c)
        if is_session:
            if not c['httponly']:
                result['issues'].append(f"Session cookie '{name}' missing HttpOnly — readable via JS (XSS risk)")
            if is_https and not c['secure']:
                result['issues'].append(f"Session cookie '{name}' missing Secure flag — sent over HTTP")
            if not samesite_val or samesite_val == 'none':
                result['issues'].append(f"Session cookie '{name}' SameSite=None or missing — CSRF risk")
    return result


# ──────────────────────────────────────────────
# Content-Type Mismatch + HTTP Smuggling Signals
# ──────────────────────────────────────────────

def _check_content_type(resp_headers: dict, body_text: str, status_code) -> dict:
    result = {'issues': []}
    ct = resp_headers.get('content-type', '').lower()
    cl = resp_headers.get('content-length', '')
    te = resp_headers.get('transfer-encoding', '').lower()

    if ct:
        if 'text/html' in ct and body_text and body_text.strip().startswith('{'):
            result['issues'].append('Content-Type says text/html but body is JSON — misconfiguration may cause XSS')
        if 'application/json' in ct and body_text and '<html' in body_text.lower():
            result['issues'].append('Content-Type says application/json but body is HTML — parser confusion risk')
        if 'text/plain' in ct and '<script' in body_text.lower():
            result['issues'].append('Content-Type text/plain with script tags — MIME sniffing XSS risk')

    if cl and te and 'chunked' in te:
        result['issues'].append('Both Content-Length and Transfer-Encoding present — HTTP request smuggling signal')

    if not resp_headers.get('x-content-type-options'):
        if ct and 'text/plain' in ct:
            result['issues'].append('X-Content-Type-Options missing with text/plain — MIME sniffing attack possible')

    return result


def load_models():
    """Load all model artifacts from models/ directory."""
    try:
        xgb_cat_path = os.path.join(MODELS_DIR, "category_model_xgb.json")
        if os.path.exists(xgb_cat_path):
            models['category_model']['xgb'] = xgb.XGBClassifier()
            models['category_model']['xgb'].load_model(xgb_cat_path)

        lgb_pkl_path = os.path.join(MODELS_DIR, "category_model_lgbm.pkl")
        lgb_txt_path = os.path.join(MODELS_DIR, "category_model_lgbm.txt")
        if os.path.exists(lgb_pkl_path):
            with open(lgb_pkl_path, 'rb') as f:
                models['category_model']['lgbm'] = pickle.load(f)
        elif os.path.exists(lgb_txt_path):
            models['category_model']['lgbm'] = lgb.Booster(model_file=lgb_txt_path)

        sev_path = os.path.join(MODELS_DIR, "severity_model.json")
        if os.path.exists(sev_path):
            models['severity_model'] = xgb.XGBClassifier()
            models['severity_model'].load_model(sev_path)

        # Load pickle artifacts
        pkl_files = {
            'tfidf': 'tfidf_vectorizer.pkl',
            'text_svd': 'tfidf_svd.pkl',
            'scaler': 'feature_scaler.pkl',
            'category_encoder': 'category_encoder.pkl',
            'severity_encoder': 'severity_encoder.pkl',
        }
        for key, filename in pkl_files.items():
            path = os.path.join(MODELS_DIR, filename)
            if os.path.exists(path):
                with open(path, 'rb') as f:
                    models[key] = pickle.load(f)

        for model_name in ['xgb', 'lgbm']:
            path = os.path.join(MODELS_DIR, f'category_calibrator_{model_name}.pkl')
            if os.path.exists(path):
                with open(path, 'rb') as f:
                    models['category_calibrators'][model_name] = pickle.load(f)

        # Load feature config
        config_path = os.path.join(MODELS_DIR, "feature_config.json")
        if os.path.exists(config_path):
            with open(config_path, 'r', encoding='utf-8') as f:
                models['feature_config'] = json.load(f)

        models['loaded'] = (
            bool(models['category_calibrators'])
            and models['tfidf'] is not None
            and models['text_svd'] is not None
            and models['scaler'] is not None
            and models['category_encoder'] is not None
        )

        # Load Phase 4 specialized per-tech classifiers
        spec_dir = os.path.join(MODELS_DIR, 'specialized')
        if os.path.exists(spec_dir):
            spec_index = os.path.join(spec_dir, 'index.json')
            if os.path.exists(spec_index):
                with open(spec_index) as f:
                    idx = json.load(f)
                for tech_name in idx:
                    pkl = os.path.join(spec_dir, f"{tech_name.lower().replace(' ','_').replace('.','')}_classifier.pkl")
                    if os.path.exists(pkl):
                        with open(pkl, 'rb') as f:
                            models['specialized'][tech_name] = pickle.load(f)
                print(f"[+] Specialized classifiers loaded: {list(models['specialized'].keys())}")

        if models['loaded']:
            print(f"[+] Models loaded successfully from {MODELS_DIR}")
        else:
            print(f"[!] Some models missing from {MODELS_DIR}")

    except Exception as e:
        print(f"[!] Error loading models: {e}")
        models['loaded'] = False


def build_features(text, features=None):
    """Build dense feature vector from text + engineered passive features."""
    config = models['feature_config']

    tfidf_vec = models['tfidf'].transform([text])
    text_reduced = models['text_svd'].transform(tfidf_vec).astype(np.float32)

    numeric_vals = []
    for feat in config['numeric_features']:
        val = 0.0
        if features and feat in features:
            val = float(features[feat])
        elif feat == 'text_length':
            val = float(len(text))
        elif feat == 'word_count':
            val = float(len(text.split()))
        numeric_vals.append(val)

    numeric_arr = models['scaler'].transform(
        np.array([numeric_vals], dtype=np.float32)
    ).astype(np.float32)

    bool_vals = []
    for feat in config['boolean_features']:
        val = 0.0
        if features and feat in features:
            val = 1.0 if features[feat] else 0.0
        bool_vals.append(val)

    bool_arr = np.array([bool_vals], dtype=np.float32)
    return np.hstack([text_reduced, numeric_arr, bool_arr]).astype(np.float32)


def build_passive_feature_map(url: str, scan_info: dict, body_features: dict, body_text: str, resp_headers: dict, probe_findings: dict, meta_generator: str) -> dict:
    """Create the engineered passive feature map expected by the trainer."""
    body_text = body_text or ''
    header_map = {k.lower(): v for k, v in resp_headers.items()}
    cookie_str = header_map.get('set-cookie', '')
    parsed = urlparse(url)
    query_keys = {k.lower() for k in parse_qs(parsed.query).keys()}
    header_text = ' '.join(f"{k}: {v}" for k, v in header_map.items())

    forms = body_features.get('forms', [])
    inputs = body_features.get('inputs', [])
    scripts = body_features.get('scripts', [])
    comments = body_features.get('comments', [])
    meta_descriptions = body_features.get('meta_descriptions', [])
    error_signals = body_features.get('error_signals', [])
    vuln_hits = body_features.get('vuln_keyword_hits', {})
    tech_stack = scan_info.get('tech_stack', [])
    missing_headers = scan_info.get('missing_headers', [])

    combined_parts = [
        body_text,
        body_features.get('title', ''),
        ' '.join(meta_descriptions[:5]),
        ' '.join(forms),
        ' '.join(inputs[:20]),
        ' '.join(scripts[:10]),
        ' '.join(comments[:10]),
        ' '.join(error_signals),
        header_text,
        cookie_str,
        meta_generator or '',
        scan_info.get('server_info', ''),
        ' '.join(tech_stack),
        ' '.join(missing_headers),
        url,
    ]
    combined_text = ' '.join(part for part in combined_parts if part).lower()

    words = combined_text.split()
    word_count = len(words)
    sentences = [s.strip() for s in re.split(r'[.!?]+', combined_text) if len(s.strip()) > 1]
    sentence_count = len(sentences) or 1
    avg_sentence_length = round(word_count / sentence_count, 1) if word_count else 0.0
    unique_word_ratio = round(len(set(words)) / word_count, 3) if word_count > 0 else 0.0

    cookie_flags = {field: (token in combined_text) for token, field in COOKIE_HINTS.items()}
    tech_features = {
        feature_name: any(token in combined_text for token in tokens)
        for feature_name, tokens in TECH_KEYWORDS.items()
    }
    version_hits = sum(combined_text.count(token) for token in VERSION_HINTS)
    vuln_keyword_total = sum(
        sum(1 for pat in patterns if pat.search(combined_text))
        for patterns in _CAT_COMPILED.values()
    )
    cat_scores = {
        f'cat_score_{cat}': sum(1 for pat in patterns if pat.search(combined_text))
        for cat, patterns in _CAT_COMPILED.items()
    }
    header_mention_count = sum(
        int(header_name in combined_text)
        for header_name in ('content-security-policy', 'strict-transport-security', 'x-frame-options')
    )

    raw_cvss = probe_findings.get('cvss_score', scan_info.get('cvss_score'))
    try:
        cvss_score = float(raw_cvss) if raw_cvss is not None else -1.0
    except (TypeError, ValueError):
        cvss_score = -1.0

    feature_map = {
        'text_length': len(combined_text),
        'word_count': word_count,
        'url_count_in_text': len(URL_RE.findall(combined_text)),
        'sentence_count': sentence_count,
        'avg_sentence_length': avg_sentence_length,
        'unique_word_ratio': unique_word_ratio,
        'code_block_count': combined_text.count('```') // 2,
        'payload_count': sum(vuln_hits.values()),
        'tools_mentioned_count': len(tech_stack),
        'cvss_score': cvss_score,
        'bounty_amount': 0.0,
        'header_mention_count': header_mention_count,
        'cookie_flag_count': sum(1 for present in cookie_flags.values() if present),
        'risky_param_count': sum(int(param in query_keys) for param in RISKY_URL_PARAMS),
        'form_keyword_count': (
            int(any(hint in combined_text for hint in LOGIN_HINTS))
            + int(any(hint in combined_text for hint in UPLOAD_HINTS))
            + int(any(hint in combined_text for hint in SEARCH_HINTS))
            + int(('method post' in combined_text) or ('<form' in combined_text and 'post' in combined_text))
        ),
        'error_signal_count': sum(combined_text.count(token) for token in ERROR_HINTS),
        'stack_trace_count': sum(combined_text.count(token) for token in STACK_HINTS),
        'js_library_count': sum(combined_text.count(token) for token in ('jquery', 'bootstrap', 'react', 'angular', 'vue')),
        'suspicious_comment_count': len(comments),
        'vuln_keyword_total': vuln_keyword_total,
        'cve_mention_count': len(re.findall(r'\bcve-\d{4}-\d+\b', combined_text, re.I)),
        'tech_indicator_count': sum(1 for present in tech_features.values() if present),
        'exposed_version_count': version_hits,
        **cat_scores,
        'has_payload': sum(vuln_hits.values()) > 0,
        'has_cwe': False,
        'has_bounty': False,
        'has_poc': any(hint in combined_text for hint in _POC_HINTS),
        'has_remediation': any(hint in combined_text for hint in _REMEDIATION_HINTS),
        'has_impact': any(hint in combined_text for hint in _IMPACT_HINTS),
        'has_wildcard_cors': ('access-control-allow-origin: *' in combined_text) or ('cors *' in combined_text) or header_map.get('access-control-allow-origin', '').strip() == '*',
        'has_login_form': any(hint in combined_text for hint in LOGIN_HINTS),
        'has_upload_form': any(hint in combined_text for hint in UPLOAD_HINTS),
        'has_search_input': any(hint in combined_text for hint in SEARCH_HINTS),
        'has_post_form': any('method post' in f.lower() for f in forms),
        'has_csrf_token': any(token in combined_text for token in ('csrf', '_token', 'authenticity_token')),
        'missing_csrf_protection': any('without csrf' in f.lower() for f in forms) or (any('method post' in f.lower() for f in forms) and not any(token in combined_text for token in ('csrf', '_token', 'authenticity_token'))),
        'has_error_leak': sum(combined_text.count(token) for token in ERROR_HINTS) > 0,
        'has_stack_trace': sum(combined_text.count(token) for token in STACK_HINTS) > 0,
        'has_version_exposure': version_hits > 0,
        'has_server_version_exposure': any(token in combined_text for token in ('server:', 'apache/', 'nginx/', 'iis', 'tomcat')),
        'has_php_exposure': 'php' in combined_text,
        'mentions_csp': 'content-security-policy' in combined_text,
        'mentions_hsts': 'strict-transport-security' in combined_text,
        'mentions_x_frame_options': 'x-frame-options' in combined_text,
        'outdated_js_detected': any(token in combined_text for token in ('jquery 1.', 'jquery-1.', 'bootstrap 3.', 'angularjs')),
        **cookie_flags,
        **tech_features,
    }
    return feature_map


def load_cve_lookup():
    """Load or build a lightweight local CVE index from merged_data.json."""
    if cve_lookup_db['loaded']:
        return

    try:
        if os.path.exists(cve_lookup_db['cache_path']):
            with open(cve_lookup_db['cache_path'], 'r', encoding='utf-8') as f:
                cached = json.load(f)
            cve_lookup_db['by_tech'] = cached.get('by_tech', {})
            cve_lookup_db['record_count'] = int(cached.get('record_count', 0))
            cve_lookup_db['loaded'] = True
            print(f"[+] CVE lookup cache loaded: {cve_lookup_db['record_count']:,} indexed records")
            return

        merged_json = os.path.join(MERGED_DATA_DIR, "merged_data.json")
        if not os.path.exists(merged_json):
            print("[!] merged_data.json not found - CVE lookup disabled")
            cve_lookup_db['loaded'] = True
            return

        with open(merged_json, 'r', encoding='utf-8') as f:
            rows = json.load(f)

        by_tech = {tech: [] for tech in TECH_CVE_KEYWORDS}
        indexed = 0
        for row in rows:
            if row.get('source') != 'cve_cwe':
                continue
            title = str(row.get('title', '')).strip()
            content = str(row.get('content', '')).strip()
            text_lower = f"{title}\n{content}".lower()
            if not title.startswith("CVE-"):
                continue

            record = {
                'cve_id': title,
                'category': row.get('category', 'OTHER'),
                'cwe_id': row.get('cwe_id', ''),
                'url': row.get('url', ''),
                'summary': content[:400],
                'versions': _extract_version_strings(content),
                'year': int(title.split('-')[1]) if len(title.split('-')) > 1 and title.split('-')[1].isdigit() else 0,
            }

            matched_any = False
            for tech, keywords in TECH_CVE_KEYWORDS.items():
                if any(keyword in text_lower for keyword in keywords):
                    by_tech[tech].append(record)
                    matched_any = True
            if matched_any:
                indexed += 1

        for tech, records in by_tech.items():
            records.sort(key=lambda r: (r.get('year', 0), r.get('cve_id', '')), reverse=True)
            by_tech[tech] = records[:500]

        payload = {
            'record_count': indexed,
            'by_tech': by_tech,
        }
        with open(cve_lookup_db['cache_path'], 'w', encoding='utf-8') as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)

        cve_lookup_db['by_tech'] = by_tech
        cve_lookup_db['record_count'] = indexed
        cve_lookup_db['loaded'] = True
        print(f"[+] CVE lookup cache built: {indexed:,} indexed records")
    except Exception as e:
        print(f"[!] Failed to load/build CVE lookup: {e}")
        cve_lookup_db['loaded'] = True


def lookup_local_cves(tech_stack: list[str], server_info: str, meta_generator: str, body_text: str = '') -> list[dict]:
    """Return top local CVE matches using detected tech plus version hints."""
    load_cve_lookup()
    if not cve_lookup_db['by_tech']:
        return []

    version_text = " ".join([server_info or '', meta_generator or '', body_text[:2000] if body_text else ''])
    version_signals = _extract_version_strings(version_text)
    matches = []
    seen = set()

    for tech in tech_stack:
        candidates = cve_lookup_db['by_tech'].get(tech, [])
        if not candidates:
            continue

        exact = []
        fallback = []
        for candidate in candidates:
            candidate_versions = candidate.get('versions') or []
            if version_signals and any(v in candidate_versions for v in version_signals):
                exact.append(candidate)
            else:
                fallback.append(candidate)

        selected = exact[:3] if exact else fallback[:2]
        for candidate in selected:
            key = (tech, candidate['cve_id'])
            if key in seen:
                continue
            seen.add(key)
            matches.append({
                'tech': tech,
                'cve_id': candidate['cve_id'],
                'category': candidate.get('category', 'OTHER'),
                'cwe_id': candidate.get('cwe_id', ''),
                'url': candidate.get('url', ''),
                'summary': candidate.get('summary', ''),
                'known_versions': candidate.get('versions', [])[:5],
                'matched_versions': [v for v in version_signals if v in (candidate.get('versions') or [])],
                'match_type': 'version' if version_signals and any(v in (candidate.get('versions') or []) for v in version_signals) else 'tech',
            })

    matches.sort(key=lambda item: (item['match_type'] == 'version', item['cve_id']), reverse=True)
    return matches[:10]


def ensemble_category_proba(X):
    """Average calibrated probabilities from available category models."""
    probs = []
    for calibrator in models['category_calibrators'].values():
        probs.append(calibrator.predict_proba(X))
    if not probs:
        raise RuntimeError("No category calibrators loaded")
    return np.mean(probs, axis=0)


DEFAULT_ACTIVE_SCAN_TOP_K = 5
DEFAULT_ACTIVE_SCAN_MIN_CONFIDENCE = 0.55
HIGH_RISK_THRESHOLD = 0.55
MEDIUM_RISK_THRESHOLD = 0.25


def predict_categories(X):
    """Get category predictions with calibrated ensemble probabilities."""
    probs = ensemble_category_proba(X)[0]
    classes = list(models['category_encoder'].classes_)

    results = []
    for i, cls in enumerate(classes):
        conf = round(float(probs[i]), 4)
        pct = round(conf * 100, 2)

        if conf >= HIGH_RISK_THRESHOLD:
            risk_level = 'high'
        elif conf >= MEDIUM_RISK_THRESHOLD:
            risk_level = 'medium'
        else:
            risk_level = 'low'

        results.append({
            'name': cls,
            'confidence': conf,
            'percentage': pct,
            'risk_level': risk_level,
        })

    results.sort(key=lambda x: x['confidence'], reverse=True)
    return results


def predict_severity(X):
    """Get severity prediction with probability."""
    if models['severity_model'] is None or models['severity_encoder'] is None:
        return {'name': 'unknown', 'confidence': 0.0}

    probs = models['severity_model'].predict_proba(X)[0]
    classes = list(models['severity_encoder'].classes_)

    best_idx = int(np.argmax(probs))
    return {
        'name': classes[best_idx],
        'confidence': round(float(probs[best_idx]), 4),
    }


# ──────────────────────────────────────────────
# FastAPI App
# ──────────────────────────────────────────────

cors_origins = [
    origin.strip()
    for origin in os.getenv("PREDICT_API_CORS_ORIGINS", ",".join(DEFAULT_CORS_ORIGINS)).split(",")
    if origin.strip()
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    global rag_retriever
    load_models()
    load_cve_lookup()
    vector_db_path = os.path.join(SCRIPT_DIR, "vector_db")
    if os.path.exists(vector_db_path):
        try:
            from build_vector_db import get_retriever
            rag_retriever = get_retriever(vector_db_path)
            if rag_retriever:
                count = rag_retriever.collection.count()
                print(f"[+] RAG vector DB loaded: {count:,} vectors")
            else:
                print("[!] RAG vector DB not found or empty")
        except Exception as e:
            print(f"[!] Failed to load RAG vector DB: {e}")
    else:
        print("[*] No vector_db/ directory found - RAG search disabled")
    yield


app = FastAPI(title="HackSentinel Prediction API", version="2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request/Response Models ──

class PredictRequest(BaseModel):
    text: str
    features: dict | None = None

class PassiveScanRequest(BaseModel):
    url: str

class ActiveScanRequest(BaseModel):
    url: str
    categories: list[str]
    tech_stack: list[str] = []
    passive_results: dict | None = None

class RAGSearchRequest(BaseModel):
    query: str
    category: str | None = None
    top_k: int = 15
    min_quality: int = 0


# ── Endpoints ──

@app.get("/health")
async def health():
    ollama_status = {
        'available': False,
        'models': {'llama3': False, 'hacksentinel-8b': False},
    }
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get("http://localhost:11434/api/tags")
            if resp.status_code == 200:
                tags = resp.json()
                model_names = [m.get('name', '').lower() for m in tags.get('models', [])]
                ollama_status['available'] = True
                # Be flexible: match llama3, llama3:latest, llama3:8b, etc.
                ollama_status['models']['llama3'] = any('llama3' in n for n in model_names)
                ollama_status['models']['hacksentinel-8b'] = any('hacksentinel-8b' in n for n in model_names)
                ollama_status['models']['deepseek-r1'] = any('deepseek' in n for n in model_names)
                
                # FALLBACK LOGIC: If llama3 is missing but deepseek or hacksentinel is here, 
                # we count it as "partially available" to keep the UI green
                if not ollama_status['models']['llama3'] and (ollama_status['models']['deepseek-r1'] or ollama_status['models']['hacksentinel-8b']):
                    ollama_status['models']['llama3'] = True # Visual fallback for UI
    except Exception:
        pass

    return {
        'status': 'ok',
        'models_loaded': models['loaded'],
        'category_model': bool(models['category_calibrators']),
        'severity_model': models['severity_model'] is not None,
        'cve_lookup_loaded': cve_lookup_db['loaded'],
        'cve_lookup_records': cve_lookup_db['record_count'],
        'category_classes': list(models['category_encoder'].classes_) if models['category_encoder'] else [],
        'severity_classes': list(models['severity_encoder'].classes_) if models['severity_encoder'] else [],
        'ollama': ollama_status,
    }


@app.post("/api/predict")
async def predict(req: PredictRequest):
    if not models['loaded']:
        raise HTTPException(status_code=503, detail="Models not loaded")

    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")

    X = build_features(text, req.features)
    categories = predict_categories(X)
    severity = predict_severity(X)

    return {
        'categories': categories,
        'severity': severity,
    }


@app.post("/api/scan/passive")
async def passive_scan(req: PassiveScanRequest, request: Request):
    if not models['loaded']:
        raise HTTPException(status_code=503, detail="Models not loaded")

    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    # Ensure URL has scheme
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url

    # Rate limiting — Redis when available, in-memory fallback otherwise
    _ip = (request.client.host if request.client else "unknown")
    if _REDIS_AVAILABLE:
        _rl_key = f"hs:rl:{_ip}"
        _count = _redis_client.incr(_rl_key)
        if _count == 1:
            _redis_client.expire(_rl_key, _RATE_WINDOW)
        if _count > _RATE_LIMIT:
            raise HTTPException(status_code=429, detail=f"Rate limit exceeded: {_RATE_LIMIT} scans/min per IP")
    else:
        _now_rl = time.time()
        _timestamps = [t for t in _MEM_RATE_STORE.get(_ip, []) if _now_rl - t < _RATE_WINDOW]
        if len(_timestamps) >= _RATE_LIMIT:
            raise HTTPException(status_code=429, detail=f"Rate limit exceeded: {_RATE_LIMIT} scans/min per IP")
        _timestamps.append(_now_rl)
        _MEM_RATE_STORE[_ip] = _timestamps

    # Return cached result if still fresh
    if _REDIS_AVAILABLE:
        _raw = _redis_client.get(_REDIS_CACHE_KEY + url)
        if _raw:
            return json.loads(_raw)
    else:
        _now = time.time()
        _cached = _SCAN_CACHE.get(url)
        if _cached and (_now - _cached['ts']) < _SCAN_CACHE_TTL:
            return _cached['result']

    start_time = time.time()
    parsed_url = urlparse(url)
    hostname   = parsed_url.hostname or ''

    scan_info = {
        'target': url, 'headers': {}, 'tech_stack': [],
        'missing_headers': [], 'server_info': '',
    }

    probe_findings  = {'exposed_paths': [], 'new_techs': [], 'vuln_signals': [], 'robots_disallowed': []}
    meta_generator  = ''
    resp_headers    = {}
    body_text       = ''
    status_code     = None
    error_page_tech = None
    js_secrets      = []
    cors_result     = {'misconfigured': False, 'allow_origin': '', 'allow_credentials': False, 'details': ''}
    open_ports      = []
    ssl_info        = {'enabled': False, 'issues': []}
    http_methods    = {'allowed_methods': [], 'dangerous': [], 'issues': []}
    csp_analysis    = {'present': False, 'quality': 'missing', 'issues': [], 'score': 0}
    cookie_analysis = {'cookies': [], 'issues': []}
    ct_analysis     = {'issues': []}

    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(15.0, connect=6.0),
            follow_redirects=True, verify=False,
        ) as client:
            # HEAD
            try:
                head_resp    = await client.head(url)
                resp_headers = dict(head_resp.headers)
                status_code  = head_resp.status_code
            except Exception:
                pass

            # GET — retry once on failure; always merge headers on top of HEAD
            for _attempt in range(2):
                try:
                    get_resp     = await client.get(url)
                    body_text    = get_resp.text[:60000]
                    # GET headers fill gaps left by HEAD (Set-Cookie, X-Powered-By, etc.)
                    resp_headers = {**resp_headers, **dict(get_resp.headers)}
                    if status_code in (405, 501) or status_code is None:
                        status_code = get_resp.status_code
                    break
                except Exception:
                    if _attempt == 1:
                        scan_info['body_fetch_failed'] = True

            # All parallel tasks (probes, CORS, JS secrets, port scan, SSL, HTTP methods)
            ssl_coro = _analyze_ssl(hostname) if url.startswith('https') else asyncio.sleep(0)
            gather_res = await asyncio.gather(
                _probe_paths(client, url),
                _fingerprint_error_page(client, url),
                _check_cors(client, url),
                _scan_js_secrets(client, body_text, url),
                _scan_ports(hostname),
                ssl_coro,
                _check_http_methods(client, url),
                return_exceptions=True,
            )
            probe_findings  = gather_res[0] if not isinstance(gather_res[0], Exception) else probe_findings
            error_page_tech = gather_res[1] if not isinstance(gather_res[1], Exception) else None
            cors_result     = gather_res[2] if not isinstance(gather_res[2], Exception) else cors_result
            js_secrets      = gather_res[3] if not isinstance(gather_res[3], Exception) else []
            open_ports      = gather_res[4] if not isinstance(gather_res[4], Exception) else []
            if isinstance(gather_res[5], dict):
                ssl_info = gather_res[5]
            if isinstance(gather_res[6], dict):
                http_methods = gather_res[6]

    except Exception as e:
        scan_info['error'] = str(e)

    # ── Header analysis ──
    keep = {'server','x-powered-by','x-aspnet-version','x-frame-options',
            'content-security-policy','strict-transport-security','x-content-type-options',
            'x-xss-protection','referrer-policy','permissions-policy','set-cookie'}
    scan_info['headers'] = {k: v for k, v in resp_headers.items() if k.lower() in keep}
    if status_code is not None:
        scan_info['status_code'] = status_code

    server     = resp_headers.get('server', '')
    powered_by = resp_headers.get('x-powered-by', '')
    scan_info['server_info'] = f"{server} {powered_by}".strip()

    for header in SECURITY_HEADERS:
        if header.lower() not in {k.lower() for k in resp_headers}:
            scan_info['missing_headers'].append(header)

    # ── Tech detection ──
    cookie_str = resp_headers.get('set-cookie', '')
    detected_techs, meta_generator = _detect_tech_stack(resp_headers, body_text, cookie_str)
    tech_set = set(detected_techs)
    tech_set.update(probe_findings.get('new_techs', []))
    if error_page_tech:
        tech_set.add(error_page_tech)
    scan_info['tech_stack']        = sorted(tech_set)
    scan_info['meta_generator']    = meta_generator
    scan_info['exposed_paths']     = probe_findings.get('exposed_paths', [])
    scan_info['robots_disallowed'] = probe_findings.get('robots_disallowed', [])

    # ── Phase 2b — WAF detection ──
    waf_detected = _detect_waf(resp_headers, body_text, cookie_str)

    # ── Phase 7 — Clickjacking ──
    clickjacking = _check_clickjacking(resp_headers)

    # ── Gap fills: CSP quality, cookie security, content-type, ──
    csp_analysis    = _analyze_csp(resp_headers)
    cookie_analysis = _analyze_cookies(resp_headers, url)
    ct_analysis     = _check_content_type(resp_headers, body_text, status_code)

    # ── CVE lookup + body analysis ──
    cve_matches   = lookup_local_cves(scan_info['tech_stack'], scan_info['server_info'], meta_generator, body_text)
    
    # Parse params for context-aware feature extraction
    parsed_url = urlparse(url)
    params = parse_qs(parsed_url.query)
    body_features = _extract_body_features(body_text, params)

    # ── Build prediction text ──
    scan_text = _build_neutral_scan_text(
        url=url, scan_info=scan_info, body_features=body_features,
        body_text=body_text, probe_findings=probe_findings,
        meta_generator=meta_generator, cve_matches=cve_matches,
    )
    extra_parts = _extract_url_features(url)
    for tech in scan_info['tech_stack']:
        extra_parts.extend(TECH_VULN_MAP.get(tech, []))
    if meta_generator:
        extra_parts.append(f"cms generator {meta_generator} version information disclosure")
    if open_ports:
        extra_parts.extend(p['vuln_signal'] for p in open_ports)
    if cors_result['misconfigured']:
        extra_parts.append('cors misconfiguration cross origin resource sharing auth bypass')
    if js_secrets:
        extra_parts.append(f"javascript secret exposed {' '.join(s['type'] for s in js_secrets[:5])}")
    if http_methods.get('dangerous'):
        extra_parts.append(f"dangerous http methods allowed {' '.join(http_methods['dangerous'])} trace xst file upload rce")
    if csp_analysis.get('issues'):
        extra_parts.append('content security policy misconfiguration bypass xss risk inline script allowed')
    if cookie_analysis.get('issues'):
        extra_parts.append('session cookie misconfiguration httponly secure samesite missing csrf xss risk')
    if ct_analysis.get('issues'):
        extra_parts.append('content type mismatch mime sniffing xss risk http smuggling')
    if extra_parts:
        scan_text = scan_text + ' ' + ' '.join(extra_parts).lower()

    # ── Model prediction ──
    passive_feature_map = build_passive_feature_map(
        url=url, scan_info=scan_info, body_features=body_features,
        body_text=body_text, resp_headers=resp_headers,
        probe_findings=probe_findings, meta_generator=meta_generator,
    )
    X = build_features(scan_text, passive_feature_map)
    all_categories = predict_categories(X)
    severity       = predict_severity(X)

    # ── Attach human-readable reasons ──
    vuln_reasons = _build_vulnerability_reasons(scan_info, body_features, url)
    for pred in all_categories:
        matched = vuln_reasons.get(pred['name'], [])
        if not matched:
            for key, val in vuln_reasons.items():
                if key.lower() in pred['name'].lower() or pred['name'].lower() in key.lower():
                    matched = val; break
        pred['reasons']        = matched
        pred['evidence_count'] = len(matched)

    # ── Phase 1 — Rule-based overrides ──
    all_categories = _apply_rule_overrides(
        all_categories, scan_info, body_features, url,
        cors_result, ssl_info, js_secrets, open_ports,
    )

    # ── Phase 4 — Specialized per-tech ensemble ──
    if models['specialized']:
        combined_text = scan_text
        cat_classes   = list(models['category_encoder'].classes_)
        conf_map      = {p['name']: p['confidence'] for p in all_categories}
        matched_specs = [
            art for tech_name, art in models['specialized'].items()
            if tech_name in scan_info['tech_stack']
        ]
        if matched_specs:
            for art in matched_specs:
                try:
                    spec_probs = art['pipeline'].predict_proba([combined_text])[0]
                    spec_classes = art['label_encoder'].classes_
                    for cls, prob in zip(spec_classes, spec_probs):
                        if cls in conf_map:
                            conf_map[cls] = round(min(0.95, conf_map[cls] * 0.6 + float(prob) * 0.4), 4)
                except Exception:
                    pass
            for pred in all_categories:
                new_conf = conf_map.get(pred['name'], pred['confidence'])
                pred['confidence'] = new_conf
                pred['percentage'] = round(new_conf * 100, 2)
                pred['risk_level'] = 'high' if new_conf >= 0.55 else ('medium' if new_conf >= 0.25 else 'low')
            all_categories.sort(key=lambda x: x['confidence'], reverse=True)

    # ── Risk score ──
    risk_score = _compute_risk_score(
        all_categories, severity, open_ports, js_secrets,
        scan_info.get('exposed_paths', []),
    )

    # ── Partition results ──
    top_k    = int((models.get('feature_config') or {}).get('active_scan_top_k', DEFAULT_ACTIVE_SCAN_TOP_K))
    min_conf = float((models.get('feature_config') or {}).get('active_scan_min_confidence', DEFAULT_ACTIVE_SCAN_MIN_CONFIDENCE))
    active_scan_candidates = [v for v in all_categories if v['confidence'] >= min_conf and v['evidence_count'] > 0][:top_k]
    detected_vulns = [v for v in all_categories if v['risk_level'] == 'high'   and v['evidence_count'] > 0]
    possible_vulns = [v for v in all_categories if v['risk_level'] == 'medium' and v['evidence_count'] > 0]
    low_risk_vulns = [v for v in all_categories if v['risk_level'] == 'low']

    scan_duration = round(time.time() - start_time, 2)

    result = {
        'target': url,
        'status_code': status_code,
        'headers': scan_info['headers'],
        'tech_stack': scan_info['tech_stack'],
        'meta_generator': meta_generator,
        'missing_headers': scan_info['missing_headers'],
        'server_info': scan_info['server_info'],
        'waf_detected': waf_detected,
        'ssl_info': ssl_info,
        'cors_result': cors_result,
        'clickjacking': clickjacking,
        'csp_analysis': csp_analysis,
        'http_methods': http_methods,
        'cookie_analysis': cookie_analysis,
        'content_type_analysis': ct_analysis,
        'js_secrets': js_secrets,
        'open_ports': open_ports,
        'risk_score': risk_score,
        'cve_lookup_matches': cve_matches,
        'exposed_paths': scan_info.get('exposed_paths', []),
        'robots_disallowed': scan_info.get('robots_disallowed', []),
        'body_features': {
            'forms_found': len(body_features['forms']),
            'inputs_found': len(body_features['inputs']),
            'scripts_found': len(body_features['scripts']),
            'comments_found': len(body_features['comments']),
            'error_signals': body_features['error_signals'],
            'vuln_keyword_hits': body_features['vuln_keyword_hits'],
        },
        'active_scan_candidates': active_scan_candidates,
        'active_scan_top_k': top_k,
        'active_scan_min_confidence': min_conf,
        'total_vulnerabilities_detected': len(detected_vulns),
        'total_possible_vulnerabilities': len(possible_vulns),
        'detected_vulnerabilities': detected_vulns,
        'possible_vulnerabilities': possible_vulns,
        'low_risk_vulnerabilities': low_risk_vulns,
        'all_predictions': all_categories,
        'predictions': all_categories,
        'severity_prediction': severity,
        'scan_duration': scan_duration,
    }

    if _REDIS_AVAILABLE:
        _redis_client.setex(_REDIS_CACHE_KEY + url, _SCAN_CACHE_TTL, json.dumps(result))
    else:
        _SCAN_CACHE[url] = {'ts': time.time(), 'result': result}
    return result


@app.get("/api/scan/cache/stats")
async def cache_stats():
    if _REDIS_AVAILABLE:
        keys = _redis_client.keys(_REDIS_CACHE_KEY + "*")
        return {"backend": "redis", "entries": len(keys), "ttl_seconds": _SCAN_CACHE_TTL, "rate_limit": f"{_RATE_LIMIT}/min"}
    _now = time.time()
    active = sum(1 for v in _SCAN_CACHE.values() if (_now - v['ts']) < _SCAN_CACHE_TTL)
    return {"backend": "memory", "entries": active, "ttl_seconds": _SCAN_CACHE_TTL, "rate_limit": "disabled (no Redis)"}


@app.delete("/api/scan/cache")
async def clear_scan_cache(url: str = None):
    if url:
        if _REDIS_AVAILABLE:
            _redis_client.delete(_REDIS_CACHE_KEY + url)
        else:
            _SCAN_CACHE.pop(url, None)
        return {"cleared": 1, "url": url}
    if _REDIS_AVAILABLE:
        keys = _redis_client.keys(_REDIS_CACHE_KEY + "*")
        if keys:
            _redis_client.delete(*keys)
        return {"cleared": len(keys)}
    count = len(_SCAN_CACHE)
    _SCAN_CACHE.clear()
    return {"cleared": count}


@app.post("/api/scan/active")
async def active_scan(req: ActiveScanRequest):
    """Run active vulnerability tests on target URL using hacksentinel-8b AI."""
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url

    try:
        from hunt_vulnerabilities import VulnerabilityHunter
        hunter = VulnerabilityHunter(rag_retriever=rag_retriever)
        result = await hunter.hunt(
            url=url,
            categories=req.categories,
            tech_stack=req.tech_stack,
            passive_results=req.passive_results,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Active scan failed: {str(e)}")


@app.post("/api/rag/search")
async def rag_search(req: RAGSearchRequest):
    """Search the vector database for relevant vulnerability writeups."""
    if rag_retriever is None:
        raise HTTPException(
            status_code=503,
            detail="RAG vector DB not loaded. Run build_vector_db.py first."
        )

    query = req.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query is required")

    results = rag_retriever.retrieve_writeups(
        query=query,
        category=req.category,
        top_k=req.top_k,
        min_quality=req.min_quality,
    )

    return {
        'query': query,
        'category_filter': req.category,
        'top_k': req.top_k,
        'min_quality': req.min_quality,
        'total_results': len(results),
        'results': results,
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
