
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest } from 'next/server';

// Inicializa Redis/Ratelimit se as variáveis estiverem presentes
let ratelimit: Ratelimit | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    // Rate limit: 60 requisições por 1 minuto
    ratelimit = new Ratelimit({
        redis: redis,
        limiter: Ratelimit.slidingWindow(60, '1 m'),
        analytics: true,
        prefix: '@upstash/ratelimit',
    });
} else {
    console.warn('[RL] Upstash credentials not found. Rate limiting is DISABLED (fail-open).');
}

export async function checkRateLimit(request: NextRequest) {
    if (!ratelimit) {
        return { success: true, limit: 0, remaining: 0, reset: 0 };
    }

    const ip = obterIp(request);
    const { success, limit, remaining, reset } = await ratelimit.limit(ip);

    console.log(`[RL] IP: ${ip} | Success: ${success} | Remaining: ${remaining}`);

    return { success, limit, remaining, reset, ip };
}

function obterIp(request: NextRequest): string {
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');

    if (forwardedFor) {
        return forwardedFor.split(',')[0].trim();
    }
    if (realIp) {
        return realIp.trim();
    }

    return 'ip-desconhecido';
}
