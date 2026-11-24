import { addMinutes, isSameDay, parse, format } from 'date-fns';

// ─── Public Types ──────────────────────────────────────────────────────────────

/**
 * Why a slot is unavailable. Used internally and exposed for UI rendering.
 * All reasons are shown identically to the end-client (no internal info leaked).
 *
 * - 'past'            — time has already passed (today only)
 * - 'occupied'        — overlaps with an existing confirmed/pending booking
 * - 'blocked'         — overlaps with a manual blocked time or holiday
 * - 'no_fit'          — service duration+buffer would exceed closing/lunch boundaries
 * - 'no_pro'          — no professional is available for the selected service
 * - 'gap_too_small'   — possible but creates an unproductive gap (not recommended)
 */
export type SlotUnavailableReason =
  | 'past'
  | 'occupied'
  | 'blocked'
  | 'no_fit'
  | 'no_pro'
  | 'gap_too_small';

export interface Slot {
  time: string;                         // "HH:mm"
  available: boolean;
  recommended: boolean;                 // among available: false = creates unproductive gap
  availableProIds: string[];
  unavailableReason?: SlotUnavailableReason; // set only when available === false
}

export interface SpecialDayConfig {
  weekday: number; // 0 (Dom) a 6 (Sáb)
  is_open: boolean;
  open_time: string;
  close_time: string;
  lunch_start?: string | null;
  lunch_end?: string | null;
}

export interface SpecialBusinessHourPeriod {
  id?: string;
  tenant_id?: string;
  name?: string | null;
  start_date: string; // "YYYY-MM-DD"
  end_date: string;   // "YYYY-MM-DD"
  same_hours_for_all?: boolean;
  days_config: SpecialDayConfig[];
  created_at?: string;
  updated_at?: string;
}

export interface EffectiveSalonHours {
  weekday: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
  lunch_start: string | null;
  lunch_end: string | null;
  _isSpecialPeriod?: boolean;
  _specialPeriodId?: string;
  _specialPeriodName?: string | null;
}

export type SpecialPeriodStatus = 'scheduled' | 'active' | 'finished';

export function getSpecialPeriodStatus(
  startDate: string,
  endDate: string,
  todayKey = toLocalDateKey(new Date())
): { key: SpecialPeriodStatus; label: string } {
  const start = (startDate || '').slice(0, 10);
  const end = (endDate || '').slice(0, 10);
  if (todayKey < start) {
    return { key: 'scheduled', label: 'Programado' };
  }
  if (todayKey > end) {
    return { key: 'finished', label: 'Finalizado' };
  }
  return { key: 'active', label: 'Em andamento' };
}

export interface AvailabilityInput {
  date: Date;
  services: any[];
  professionalId: string | 'any';
  professionals: any[];
  allServices: any[];
  businessHours: any[];
  proWorkingHours: any[];
  blockedTimes: any[];
  existingBookings: any[];
  proServices: any[];
  /** Hybrid location model: 'instore' (default) or 'home' */
  serviceLocation?: 'instore' | 'home';
  /** Distance from client to salon in km (used to filter pros by max_home_distance_km) */
  clientDistanceKm?: number | null;
  /** Global salon home service radius in km (fallback when pro has no own radius) */
  salonHomeRadiusKm?: number;
  /** Optional list of special business hour periods configured by the salon */
  specialBusinessHours?: SpecialBusinessHourPeriod[] | null;
}

// ─── Internal Types ────────────────────────────────────────────────────────────

interface TimeInterval {
  start: Date;
  end: Date;
}

// ─── Special Business Hours Resolution (Centralized Engine) ──────────────────

/**
 * Converts a Date or ISO/date string into a local "YYYY-MM-DD" key.
 */
export function toLocalDateKey(date: Date | string): string {
  if (typeof date === 'string') {
    const trimmed = date.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return format(parsed, 'yyyy-MM-dd');
    }
    return trimmed.slice(0, 10);
  }
  return format(date, 'yyyy-MM-dd');
}

/**
 * Converts a Date or "YYYY-MM-DD" string into a safe local Date instance.
 */
function toTargetDate(date: Date | string): Date {
  if (typeof date === 'string') {
    const trimmed = date.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return parse(trimmed, 'yyyy-MM-dd', new Date());
    }
    return new Date(trimmed);
  }
  return date;
}

/**
 * Finds the active special business hour period covering `date`, if any.
 */
export function findActiveSpecialPeriodForDate(
  date: Date | string,
  specialPeriods?: SpecialBusinessHourPeriod[] | null
): SpecialBusinessHourPeriod | null {
  if (!specialPeriods || !Array.isArray(specialPeriods) || specialPeriods.length === 0) {
    return null;
  }
  const dateKey = toLocalDateKey(date);
  for (const period of specialPeriods) {
    if (!period || !period.start_date || !period.end_date) continue;
    const startKey = String(period.start_date).slice(0, 10);
    const endKey = String(period.end_date).slice(0, 10);
    if (startKey <= dateKey && dateKey <= endKey) {
      return period;
    }
  }
  return null;
}

/**
 * Central rule of priority:
 * - When `date` falls within a registered special period (`start_date <= date <= end_date`),
 *   the special period configuration COMPLETELY REPLACES the standard `businessHours` for that date.
 * - If the weekday is enabled in the special period, returns the special period's open/close/lunch hours.
 * - If the weekday is NOT enabled in the special period, returns `is_open: false` (never falls back to standard hours).
 * - Outside any special period, returns the standard `businessHours` entry for that weekday.
 */
function normalizeCloseTimeStr(raw: string | null | undefined, fallback = '18:00'): string {
  const clean = String(raw || fallback).slice(0, 5);
  return clean === '00:00' ? '23:59' : clean;
}

export function resolveEffectiveBusinessHoursForDate(
  date: Date | string,
  businessHours: any[],
  specialPeriods?: SpecialBusinessHourPeriod[] | null
): EffectiveSalonHours | null {
  const targetDate = toTargetDate(date);
  const weekday = targetDate.getDay();

  // Check if specialPeriods contains an active period for this date
  const activeSpecial = findActiveSpecialPeriodForDate(targetDate, specialPeriods);
  if (activeSpecial) {
    let rawDays: SpecialDayConfig[] = [];
    if (Array.isArray(activeSpecial.days_config)) {
      rawDays = activeSpecial.days_config;
    } else if (typeof activeSpecial.days_config === 'string') {
      try {
        const parsed = JSON.parse(activeSpecial.days_config);
        if (Array.isArray(parsed)) rawDays = parsed;
      } catch {
        rawDays = [];
      }
    }

    const specialDay = rawDays.find((d) => Number(d.weekday) === weekday);
    if (!specialDay || !specialDay.is_open) {
      return {
        weekday,
        is_open: false,
        open_time: '09:00',
        close_time: '18:00',
        lunch_start: null,
        lunch_end: null,
        _isSpecialPeriod: true,
        _specialPeriodId: activeSpecial.id,
        _specialPeriodName: activeSpecial.name ?? null,
      };
    }

    return {
      weekday,
      is_open: true,
      open_time: String(specialDay.open_time || '09:00').slice(0, 5),
      close_time: normalizeCloseTimeStr(specialDay.close_time, '18:00'),
      lunch_start: specialDay.lunch_start ? String(specialDay.lunch_start).slice(0, 5) : null,
      lunch_end: specialDay.lunch_end ? String(specialDay.lunch_end).slice(0, 5) : null,
      _isSpecialPeriod: true,
      _specialPeriodId: activeSpecial.id,
      _specialPeriodName: activeSpecial.name ?? null,
    };
  }

  // If no specialPeriods array was passed, check if `businessHours` already has a pre-resolved entry
  const std = (businessHours || []).find((h) => Number(h.weekday) === weekday);
  if (!std) return null;

  if (std._isSpecialPeriod !== undefined) {
    return std as EffectiveSalonHours;
  }

  return {
    ...std,
    weekday,
    is_open: Boolean(std.is_open),
    open_time: String(std.open_time || '09:00').slice(0, 5),
    close_time: normalizeCloseTimeStr(std.close_time, '18:00'),
    lunch_start: std.lunch_start ? String(std.lunch_start).slice(0, 5) : null,
    lunch_end: std.lunch_end ? String(std.lunch_end).slice(0, 5) : null,
    _isSpecialPeriod: false,
  };
}

/**
 * Returns a `businessHours` array where the entry for `date.getDay()` is replaced
 * with the effective hours resolved from `specialPeriods` (or standard `businessHours`).
 */
export function getEffectiveBusinessHoursForDate(
  date: Date | string,
  businessHours: any[],
  specialPeriods?: SpecialBusinessHourPeriod[] | null
): any[] {
  const targetDate = toTargetDate(date);
  const weekday = targetDate.getDay();
  const effective = resolveEffectiveBusinessHoursForDate(targetDate, businessHours, specialPeriods);
  const others = (businessHours || []).filter((h) => Number(h.weekday) !== weekday);
  return effective ? [...others, effective] : [...others];
}

// ─── Helper: GCD ──────────────────────────────────────────────────────────────

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function gcdMany(values: number[]): number {
  if (values.length === 0) return 15;
  return values.reduce((acc, v) => gcd(acc, v));
}

// ─── Helper: Overlap check ────────────────────────────────────────────────────

function overlaps(a: TimeInterval, b: TimeInterval): boolean {
  return a.start < b.end && b.start < a.end;
}

// ─── Helper: Parse time string on a given date ────────────────────────────────

function parseTime(timeStr: string, baseDate: Date): Date {
  try {
    if (timeStr.length === 8) return parse(timeStr, 'HH:mm:ss', baseDate);
    return parse(timeStr, 'HH:mm', baseDate);
  } catch {
    return parse(timeStr, 'HH:mm', baseDate);
  }
}

// ─── Compute granularity via GCD of all service durations ─────────────────────

export function computeGranularity(allServices: any[]): number {
  const durations = allServices
    .map((s) => s.duration_minutes || 0)
    .filter((d) => d > 0);

  if (durations.length === 0) return 15;
  const g = gcdMany(durations);
  return Math.max(5, Math.min(g, 30));
}

// ─── Compute total block size for selected services ───────────────────────────

function computeBlockSize(services: any[]): number {
  if (services.length === 0) return 0;
  const duration = services.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
  const buffer = services[services.length - 1]?.buffer_minutes || 0;
  return duration + buffer;
}

// ─── Compute min service duration for a professional ─────────────────────────

function computeMinServiceDuration(pro: any, allServices: any[], proServices: any[]): number {
  const linkedIds = proServices
    .filter((ps) => ps.professional_id === pro.id)
    .map((ps) => ps.service_id);

  const relevantServices =
    linkedIds.length > 0
      ? allServices.filter((s) => linkedIds.includes(s.id))
      : allServices;

  const durations = relevantServices
    .map((s) => (s.duration_minutes || 0) + (s.buffer_minutes || 0))
    .filter((d) => d > 0);

  if (durations.length === 0) return 15;
  return Math.min(...durations);
}

// ─── Compute free blocks for a professional ───────────────────────────────────

function computeFreeBlocks(
  pro: any,
  date: Date,
  salonHours: any,
  proWorkingHours: any[],
  blockedTimes: any[],
  existingBookings: any[],
  allServices: any[]
): TimeInterval[] {
  const weekday = date.getDay();
  const isSpecialPeriod = Boolean(salonHours?._isSpecialPeriod);

  // When a special period is active for this date, the special period's schedule
  // replaces the standard weekly schedule (while preserving blockedTimes and bookings).
  const ph = isSpecialPeriod
    ? null
    : proWorkingHours.find(
        (h) => h.professional_id === pro.id && h.weekday === weekday
      );

  if (ph && ph.is_working === false) return [];

  const proOpen = ph?.open_time
    ? parseTime(ph.open_time, date)
    : parseTime(salonHours.open_time, date);
  const proClose = ph?.close_time
    ? parseTime(ph.close_time, date)
    : parseTime(salonHours.close_time, date);

  let freeBlocks: TimeInterval[] = [{ start: proOpen, end: proClose }];

  // Subtract lunch
  const lunchStart = ph?.lunch_start
    ? parseTime(ph.lunch_start, date)
    : salonHours.lunch_start
    ? parseTime(salonHours.lunch_start, date)
    : null;
  const lunchEnd = ph?.lunch_end
    ? parseTime(ph.lunch_end, date)
    : salonHours.lunch_end
    ? parseTime(salonHours.lunch_end, date)
    : null;

  if (lunchStart && lunchEnd) {
    freeBlocks = subtractInterval(freeBlocks, { start: lunchStart, end: lunchEnd });
  }

  // Subtract blocked times
  const proBlocks = blockedTimes.filter(
    (b) => b.professional_id === pro.id || b.professional_id === null
  );
  for (const block of proBlocks) {
    const bs = new Date(block.starts_at || block.start_at);
    const be = new Date(block.ends_at || block.end_at);
    if (!isNaN(bs.getTime()) && !isNaN(be.getTime())) {
      freeBlocks = subtractInterval(freeBlocks, { start: bs, end: be });
    }
  }

  // Subtract existing bookings
  const proBookings = existingBookings.filter((b) => b.professional_id === pro.id);
  for (const booking of proBookings) {
    const bStart = new Date(booking.scheduled_at);
    if (isNaN(bStart.getTime())) continue;
    const bookedService = allServices.find((s) => s.id === booking.service_id) || booking.service || booking.services;
    const bDuration =
      (bookedService?.duration_minutes ?? booking.duration_minutes ?? 30) +
      (bookedService?.buffer_minutes ?? booking.buffer_minutes ?? 0);
    freeBlocks = subtractInterval(freeBlocks, {
      start: bStart,
      end: addMinutes(bStart, bDuration),
    });
  }

  return freeBlocks;
}

// ─── Helper: Subtract one interval from list of free blocks ──────────────────

function subtractInterval(blocks: TimeInterval[], sub: TimeInterval): TimeInterval[] {
  const result: TimeInterval[] = [];
  for (const block of blocks) {
    if (!overlaps(block, sub)) {
      result.push(block);
      continue;
    }
    if (block.start < sub.start) result.push({ start: block.start, end: sub.start });
    if (block.end > sub.end) result.push({ start: sub.end, end: block.end });
  }
  return result;
}

// ─── Determine unavailability reason for one candidate on one professional ────

/**
 * Analyses why a specific candidate slot [start, start+blockSize] is
 * NOT available for a given professional. Returns null if it IS available.
 *
 * Priority order (most actionable reason first):
 *   past → blocked → occupied → no_fit
 */
function getUnavailableReasonForPro(
  slotStart: Date,
  blockSize: number,
  pro: any,
  date: Date,
  salonHours: any,
  proWorkingHours: any[],
  blockedTimes: any[],
  existingBookings: any[],
  allServices: any[],
  now: Date
): SlotUnavailableReason | null {
  const slotEnd = addMinutes(slotStart, blockSize);
  const weekday = date.getDay();
  const isSpecialPeriod = Boolean(salonHours?._isSpecialPeriod);

  // 1. Past
  if (isSameDay(slotStart, now) && slotStart <= now) return 'past';

  // 2. Pro not working today (ignored when a special salon schedule overrides the standard week)
  const ph = isSpecialPeriod
    ? null
    : proWorkingHours.find(
        (h) => h.professional_id === pro.id && h.weekday === weekday
      );
  if (ph && ph.is_working === false) return 'no_fit';

  // 3. Outside pro/salon working hours
  const proOpen = ph?.open_time
    ? parseTime(ph.open_time, date)
    : parseTime(salonHours.open_time, date);
  const proClose = ph?.close_time
    ? parseTime(ph.close_time, date)
    : parseTime(salonHours.close_time, date);

  if (slotStart < proOpen || slotEnd > proClose) return 'no_fit';

  // 4. Lunch overlap
  const lunchStart = ph?.lunch_start
    ? parseTime(ph.lunch_start, date)
    : salonHours.lunch_start
    ? parseTime(salonHours.lunch_start, date)
    : null;
  const lunchEnd = ph?.lunch_end
    ? parseTime(ph.lunch_end, date)
    : salonHours.lunch_end
    ? parseTime(salonHours.lunch_end, date)
    : null;

  if (lunchStart && lunchEnd) {
    if (overlaps({ start: slotStart, end: slotEnd }, { start: lunchStart, end: lunchEnd })) {
      return 'no_fit';
    }
  }

  // 5. Blocked times (pro-specific or salon-wide)
  const proBlocks = blockedTimes.filter(
    (b) => b.professional_id === pro.id || b.professional_id === null
  );
  for (const block of proBlocks) {
    const bs = new Date(block.starts_at || block.start_at);
    const be = new Date(block.ends_at || block.end_at);
    if (!isNaN(bs.getTime()) && !isNaN(be.getTime())) {
      if (overlaps({ start: slotStart, end: slotEnd }, { start: bs, end: be })) {
        return 'blocked';
      }
    }
  }

  // 6. Existing bookings
  const proBookings = existingBookings.filter((b) => b.professional_id === pro.id);
  for (const booking of proBookings) {
    const bStart = new Date(booking.scheduled_at);
    if (isNaN(bStart.getTime())) continue;
    const bookedService = allServices.find((s) => s.id === booking.service_id) || booking.service || booking.services;
    const bDuration =
      (bookedService?.duration_minutes ?? booking.duration_minutes ?? 30) +
      (bookedService?.buffer_minutes ?? booking.buffer_minutes ?? 0);
    const bEnd = addMinutes(bStart, bDuration);
    if (overlaps({ start: slotStart, end: slotEnd }, { start: bStart, end: bEnd })) {
      return 'occupied';
    }
  }

  return null; // available
}

// ─── Main: isRecommended ──────────────────────────────────────────────────────

function isRecommended(
  slotStart: Date,
  blockSize: number,
  freeBlocks: TimeInterval[],
  minServiceDuration: number
): boolean {
  const serviceEnd = addMinutes(slotStart, blockSize);

  // Find which free block this slot sits in
  const hostBlock = freeBlocks.find(
    (b) => b.start <= slotStart && serviceEnd <= b.end
  );
  if (!hostBlock) return false;

  const gapAfterMin = (hostBlock.end.getTime() - serviceEnd.getTime()) / 60000;
  if (gapAfterMin <= 0) return true;
  if (gapAfterMin >= minServiceDuration) return true;
  return false;
}

// ─── Main Export: generateAvailableSlots ─────────────────────────────────────

/**
 * Generates the FULL slot grid for a day — available AND unavailable slots.
 *
 * Unavailable slots are included with `available: false` and an
 * `unavailableReason` so the UI can render them as grayed/strikethrough.
 * No client-identifiable information is embedded.
 */
export function generateAvailableSlots(
  date: Date,
  service: any,
  selectedProfessionalId: string | 'any' | null | undefined,
  professionals: any[],
  allServices: any[],
  businessHours: any[],
  proWorkingHours: any[],
  blockedTimes: any[],
  existingBookings: any[],
  proServices: any[],
  selectedServices?: any[],
  /** Hybrid location: 'instore' (default) or 'home' */
  serviceLocation: 'instore' | 'home' = 'instore',
  /** Distance from client to salon in km */
  clientDistanceKm?: number | null,
  /** Global salon home radius (fallback) */
  salonHomeRadiusKm?: number,
  /** Optional list of special business hours periods */
  specialBusinessHours?: SpecialBusinessHourPeriod[] | null
): Slot[] {
  const services: any[] =
    selectedServices && selectedServices.length > 0
      ? selectedServices
      : service
      ? [service]
      : [];

  if (services.length === 0) return [];

  const targetDate = toTargetDate(date);
  const salonHours = resolveEffectiveBusinessHoursForDate(
    targetDate,
    businessHours,
    specialBusinessHours
  );
  if (!salonHours || !salonHours.is_open) return [];

  const now = new Date();
  const blockSize = computeBlockSize(services);
  if (blockSize === 0) return [];

  const granularity = computeGranularity(allServices);

  // Determine candidate professionals
  let prosToCheck =
    !selectedProfessionalId || selectedProfessionalId === 'any'
      ? professionals
      : professionals.filter((p) => p.id === selectedProfessionalId);

  // ── Home service filter (migration 0046) ────────────────────────────────────
  // If the client is booking a home visit, only show professionals that:
  // 1. Have offers_home_service === true
  // 2. Can reach the client (within their own radius or the salon's global radius)
  if (serviceLocation === 'home') {
    const salonRadius = salonHomeRadiusKm ?? 10;
    prosToCheck = prosToCheck.filter((pro) => {
      if (!pro.offers_home_service) return false;
      if (clientDistanceKm == null) return true; // no coords → show all home-service pros
      const effectiveRadius =
        pro.max_home_distance_km && pro.max_home_distance_km > 0
          ? pro.max_home_distance_km
          : salonRadius;
      if (!effectiveRadius || effectiveRadius <= 0) return true;
      return clientDistanceKm <= effectiveRadius;
    });
  }
  // ────────────────────────────────────────────────────────────────────────────

  if (proServices.length > 0) {
    prosToCheck = prosToCheck.filter((pro) => {
      const linked = proServices
        .filter((ps) => ps.professional_id === pro.id)
        .map((ps) => ps.service_id);
      if (linked.length === 0) return true;
      return services.every((svc) => linked.includes(svc.id));
    });
  }

  // Full working day range for scanning (salon open → close)
  const salonOpen = parseTime(salonHours.open_time, targetDate);
  const salonClose = parseTime(salonHours.close_time, targetDate);

  // Collect all candidate times (full day at granularity steps)
  const candidateTimes: Date[] = [];
  let cur = new Date(salonOpen);
  while (cur < salonClose) {
    candidateTimes.push(new Date(cur));
    cur = addMinutes(cur, granularity);
  }

  // Per professional: pre-compute free blocks and min duration
  const proFreeBlocks = new Map<string, TimeInterval[]>();
  const proMinDuration = new Map<string, number>();

  for (const pro of prosToCheck) {
    const fb = computeFreeBlocks(
      pro, targetDate, salonHours, proWorkingHours, blockedTimes, existingBookings, allServices
    );
    proFreeBlocks.set(pro.id, fb);
    proMinDuration.set(pro.id, computeMinServiceDuration(pro, allServices, proServices));
  }

  // Build slot map: time → Slot
  const slotMap = new Map<
    string,
    {
      availableProIds: string[];
      unavailableReasons: SlotUnavailableReason[];
      recommendedByPro: boolean[];
    }
  >();

  // Scan every candidate time
  for (const slotStart of candidateTimes) {
    const timeKey = format(slotStart, 'HH:mm');
    const slotEnd = addMinutes(slotStart, blockSize);

    // Skip slots that would exceed salon closing entirely
    if (slotEnd > salonClose) {
      // Still add as 'no_fit' so it shows in the grid
      slotMap.set(timeKey, {
        availableProIds: [],
        unavailableReasons: ['no_fit'],
        recommendedByPro: [],
      });
      continue;
    }

    if (!slotMap.has(timeKey)) {
      slotMap.set(timeKey, {
        availableProIds: [],
        unavailableReasons: [],
        recommendedByPro: [],
      });
    }

    const entry = slotMap.get(timeKey)!;

    if (prosToCheck.length === 0) {
      entry.unavailableReasons.push('no_pro');
      continue;
    }

    for (const pro of prosToCheck) {
      const reason = getUnavailableReasonForPro(
        slotStart, blockSize, pro, targetDate,
        salonHours, proWorkingHours, blockedTimes, existingBookings, allServices, now
      );

      if (reason === null) {
        // Available for this pro
        entry.availableProIds.push(pro.id);
        const fb = proFreeBlocks.get(pro.id) || [];
        const minDur = proMinDuration.get(pro.id) || 15;
        entry.recommendedByPro.push(isRecommended(slotStart, blockSize, fb, minDur));
      } else {
        entry.unavailableReasons.push(reason);
      }
    }
  }

  // Convert map to sorted Slot[]
  const slots: Slot[] = [];

  for (const [time, entry] of Array.from(slotMap.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    if (entry.availableProIds.length > 0) {
      slots.push({
        time,
        available: true,
        recommended: entry.recommendedByPro.some(Boolean),
        availableProIds: entry.availableProIds,
      });
    } else {
      // Pick the most "meaningful" reason to show the UI
      // Priority: past > blocked > occupied > no_fit > no_pro
      const PRIORITY: SlotUnavailableReason[] = ['past', 'blocked', 'occupied', 'no_fit', 'no_pro'];
      const sortedReasons = entry.unavailableReasons
        .slice()
        .sort((a, b) => PRIORITY.indexOf(a) - PRIORITY.indexOf(b));

      const topReason = sortedReasons[0] as SlotUnavailableReason | undefined;

      // Don't show 'past' slots that are before salon open
      if (topReason === 'past' || topReason === 'no_fit') {
        // Still include these — UI can choose to hide 'no_fit' or show grayed
        slots.push({
          time,
          available: false,
          recommended: false,
          availableProIds: [],
          unavailableReason: topReason,
        });
      } else {
        // occupied / blocked / no_pro → always show as grayed
        slots.push({
          time,
          available: false,
          recommended: false,
          availableProIds: [],
          unavailableReason: topReason || 'occupied',
        });
      }
    }
  }

  return slots;
}

// ─── Typed entry point for multi-service calls ────────────────────────────────

export function generateAvailableSlotsFromInput(input: AvailabilityInput): Slot[] {
  return generateAvailableSlots(
    input.date,
    null,
    input.professionalId,
    input.professionals,
    input.allServices,
    input.businessHours,
    input.proWorkingHours,
    input.blockedTimes,
    input.existingBookings,
    input.proServices,
    input.services,
    input.serviceLocation ?? 'instore',
    input.clientDistanceKm ?? null,
    input.salonHomeRadiusKm ?? 10,
    input.specialBusinessHours ?? null
  );
}
