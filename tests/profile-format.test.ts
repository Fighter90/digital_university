// DIG-19 — pure formatters of the profile screen.
// Red-first: the module src/lib/profile-format.ts does not exist yet.
import { describe, expect, it } from 'vitest';
import {
  currentAcademicPeriod,
  formatSessionTime,
  maskStudentBadge,
  sessionDeviceLabel,
} from '@/lib/profile-format';

describe('maskStudentBadge', () => {
  it('hides the middle of the gradebook number, keeps year prefix and last 2 digits', () => {
    expect(maskStudentBadge('20231234')).toBe('2023-12-••••34');
    expect(maskStudentBadge('20254567')).toBe('2025-45-••••67');
  });

  it('never leaks the masked middle digits', () => {
    const masked = maskStudentBadge('20231234');
    expect(masked).not.toContain('1234');
    expect(masked).toContain('••••');
  });

  it('accepts pre-formatted input (dashes are ignored)', () => {
    expect(maskStudentBadge('2023-1234')).toBe('2023-12-••••34');
  });

  it('masks short numbers but still keeps the last 2 digits', () => {
    expect(maskStudentBadge('12345')).toBe('••••••45');
  });

  it('masks an empty value completely', () => {
    expect(maskStudentBadge('')).toBe('••••••');
  });
});

describe('currentAcademicPeriod', () => {
  it('November 2026 → 2026/2027, autumn term', () => {
    expect(currentAcademicPeriod(new Date(2026, 10, 11))).toEqual({
      year: '2026/2027',
      term: 'осенний семестр',
    });
  });

  it('February 2027 → still 2026/2027, spring term', () => {
    expect(currentAcademicPeriod(new Date(2027, 1, 10))).toEqual({
      year: '2026/2027',
      term: 'весенний семестр',
    });
  });

  it('late August starts the new academic year (autumn)', () => {
    expect(currentAcademicPeriod(new Date(2026, 7, 25))).toEqual({
      year: '2026/2027',
      term: 'осенний семестр',
    });
  });

  it('July belongs to the previous academic year (spring term)', () => {
    expect(currentAcademicPeriod(new Date(2026, 6, 15))).toEqual({
      year: '2025/2026',
      term: 'весенний семестр',
    });
  });

  it('January belongs to the academic year started the previous autumn', () => {
    expect(currentAcademicPeriod(new Date(2026, 0, 15))).toEqual({
      year: '2025/2026',
      term: 'весенний семестр',
    });
  });
});

describe('formatSessionTime', () => {
  it('formats a session start as «д мес., чч:мм» in ru', () => {
    const label = formatSessionTime(new Date(2026, 10, 11, 9, 5));
    expect(label).toContain('нояб');
    expect(label).toContain('09:05');
  });

  it('null (old session rows) renders as a dash', () => {
    expect(formatSessionTime(null)).toBe('—');
  });
});

describe('sessionDeviceLabel', () => {
  it('iPhone Safari', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    expect(sessionDeviceLabel(ua)).toBe('iPhone · Safari');
  });

  it('Windows Chrome', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
    expect(sessionDeviceLabel(ua)).toBe('Windows · Chrome');
  });

  it('Android Chrome', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
    expect(sessionDeviceLabel(ua)).toBe('Android · Chrome');
  });

  it('macOS Safari', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
    expect(sessionDeviceLabel(ua)).toBe('macOS · Safari');
  });

  it('unknown engine falls back to a neutral label, raw UA never leaks', () => {
    expect(sessionDeviceLabel('SomeRareBrowser/1.0')).toBe('Другое устройство');
    expect(sessionDeviceLabel(null)).toBe('Неизвестное устройство');
    for (const label of [
      sessionDeviceLabel('Mozilla/5.0 (Windows NT 10.0) Chrome/1'),
      sessionDeviceLabel(null),
    ]) {
      expect(label).not.toMatch(/Mozilla|KHTML|AppleWebKit/);
    }
  });
});
