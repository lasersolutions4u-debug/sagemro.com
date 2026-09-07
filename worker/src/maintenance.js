const origins = new Set(['com', 'cn'].flatMap(market =>
  ['', 'www.', 'ai.', 'admin.', 'engineer.'].map(prefix => `https://${prefix}sagemro.${market}`),
));

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin');
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Retry-After': '300',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      Vary: 'Origin',
    };
    if (origins.has(origin)) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Credentials'] = 'true';
      headers['Access-Control-Allow-Methods'] = 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS';
      headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-CSRF-Token';
      headers['Access-Control-Expose-Headers'] = 'Retry-After';
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const cn = new URL(request.url).hostname === 'api.sagemro.cn'
      || (origins.has(origin) && origin.endsWith('.cn'));
    const body = JSON.stringify({
      code: 'MAINTENANCE',
      maintenance: true,
      error: cn ? '系统维护中，服务暂时不可用。请稍后重试。' : 'Scheduled maintenance is in progress. Service is temporarily unavailable. Please try again later.',
    });
    return new Response(request.method === 'HEAD' ? null : body, { status: 503, headers });
  },
  async scheduled() {},
};
