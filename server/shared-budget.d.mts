export function createSharedReservation(options?: {url?: string; token?: string; key?: string; fetchImpl?: typeof fetch; now?: () => number}): (limit: number) => Promise<boolean>;
