import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';

export async function hashValue(
  value: string,
  rounds: number,
): Promise<string> {
  return bcrypt.hash(value, rounds);
}

export async function compareHash(
  value: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(value, hash);
}

export function generateOtp(): string {
  return randomInt(100000, 999999).toString();
}

export function generateSecureToken(): string {
  return randomInt(100000000, 999999999).toString() + Date.now().toString(36);
}

export function normalizeMobile(mobile: string): string {
  return mobile.replace(/\D/g, '').slice(-10);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function parseDurationToMs(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 15 * 60 * 1000;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return 15 * 60 * 1000;
  }
}

export function parseDurationToDays(duration: string): number {
  const match = duration.match(/^(\d+)d$/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return 30;
}
