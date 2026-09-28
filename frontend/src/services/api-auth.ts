export function shouldRedirectAfterUnauthorized(url?: string): boolean {
    if (!url) return true;
    return !/(?:^|\/)auth\/(?:admin|user|seller)\/(?:login|send-otp|verify-otp)(?:$|\?)/.test(url);
}
