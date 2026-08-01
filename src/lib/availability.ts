import { addMinutes, isBefore, isSameDay, parse, format } from 'date-fns';

export interface Slot {
  time: string; // HH:mm
  available: boolean;
  availableProIds: string[];
  reason?: string;
}

/**
 * Checks if a time range [start, end] overlaps with another [blockStart, blockEnd].
 * Standard overlap formula: Max(start1, start2) < Min(end1, end2)
 */
function isOverlapping(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
  return start1 < end2 && start2 < end1;
}

/**
 * Generates availability slots for a specific date.
 */
export function generateAvailableSlots(
  date: Date,
  service: any,
  selectedProfessionalId: string | 'any',
  professionals: any[],
  allServices: any[],
  businessHours: any[],
  proHours: any[],
  blocks: any[],
  bookings: any[],
  proServices: any[]
): Slot[] {
  // Find salon hours for this weekday
  const weekday = date.getDay();
  const salonHours = businessHours.find((h: any) => h.weekday === weekday);
  
  if (!salonHours || !salonHours.is_open) return [];

  // Determine which professionals we are checking
  let prosToCheck = selectedProfessionalId === 'any' 
    ? professionals 
    : professionals.filter(p => p.id === selectedProfessionalId);

  // If selecting 'any', filter out professionals that do not perform the requested service
  // Note: if a tenant has 0 links in proServices, we assume all pros can do all services as a fallback
  if (selectedProfessionalId === 'any' && proServices.length > 0) {
    const prosThatDoService = proServices.filter((ps: any) => ps.service_id === service.id).map((ps: any) => ps.professional_id);
    if (prosThatDoService.length > 0) {
      prosToCheck = prosToCheck.filter(p => prosThatDoService.includes(p.id));
    }
  }

  if (prosToCheck.length === 0) return [];

  // Parse open and close times
  let openTime = parse(salonHours.open_time, "HH:mm:ss", date);
  const closeTime = parse(salonHours.close_time, "HH:mm:ss", date);
  const now = new Date();

  const slots: Slot[] = [];
  const serviceDuration = (service?.duration_minutes || 0) + (service?.buffer_minutes || 0);
  
  // We'll generate slots every 15 minutes as requested
  const INTERVAL = 15;
  
  let cur = openTime;

  while (isBefore(cur, closeTime)) {
    const slotStart = cur;
    const slotEnd = addMinutes(slotStart, serviceDuration);
    const timeStr = format(slotStart, "HH:mm");

    // Advance loop
    cur = addMinutes(cur, INTERVAL);

    // 1. Check if the service finishes after salon closing time
    if (slotEnd > closeTime) {
      // We don't even show slots that exceed closing time
      continue;
    }

    // 2. Check if slot is in the past (for today)
    if (isSameDay(slotStart, now) && slotStart <= now) {
      slots.push({ time: timeStr, available: false, availableProIds: [], reason: 'past' });
      continue;
    }

    // 3. Check if at least one professional can take this slot
    const availableProIds: string[] = [];

    for (const pro of prosToCheck) {
      let isProAvailable = true;

      // 3a. Check Professional Working Hours
      const ph = proHours.find((h: any) => h.professional_id === pro.id && h.weekday === weekday);
      
      if (ph && !ph.is_working) {
        isProAvailable = false;
      } else {
        // If they have custom open/close time
        if (ph && ph.open_time && ph.close_time) {
          const proStart = parse(ph.open_time, "HH:mm:ss", date);
          const proEnd = parse(ph.close_time, "HH:mm:ss", date);
          if (slotStart < proStart || slotEnd > proEnd) {
            isProAvailable = false;
          }
        }
        
        // Check Lunch Time
        if (isProAvailable && ph && ph.lunch_start && ph.lunch_end) {
          const lunchStart = parse(ph.lunch_start, "HH:mm:ss", date);
          const lunchEnd = parse(ph.lunch_end, "HH:mm:ss", date);
          if (isOverlapping(slotStart, slotEnd, lunchStart, lunchEnd)) {
            isProAvailable = false;
          }
        }
      }

      // Check Salon Lunch time (fallback)
      if (isProAvailable && (!ph || !ph.lunch_start)) {
        if (salonHours.lunch_start && salonHours.lunch_end) {
          const lunchStart = parse(salonHours.lunch_start, "HH:mm:ss", date);
          const lunchEnd = parse(salonHours.lunch_end, "HH:mm:ss", date);
          if (isOverlapping(slotStart, slotEnd, lunchStart, lunchEnd)) {
            isProAvailable = false;
          }
        }
      }

      // 3b. Check Blocked Times
      if (isProAvailable) {
        const proBlocks = blocks.filter((b: any) => b.professional_id === pro.id || b.professional_id === null); 
        for (const block of proBlocks) {
          const blockStart = new Date(block.starts_at);
          const blockEnd = new Date(block.ends_at);
          if (isOverlapping(slotStart, slotEnd, blockStart, blockEnd)) {
            isProAvailable = false;
            break;
          }
        }
      }

      // 3c. Check Existing Bookings
      if (isProAvailable) {
        const proBookings = bookings.filter((b: any) => b.professional_id === pro.id);
        for (const booking of proBookings) {
          const bStart = new Date(booking.scheduled_at);
          
          // Find duration of the booked service
          const bookedService = allServices.find((s: any) => s.id === booking.service_id);
          const bDuration = bookedService ? (bookedService.duration_minutes || 0) + (bookedService.buffer_minutes || 0) : 30; // default 30 if not found
          const bEnd = addMinutes(bStart, bDuration);

          if (isOverlapping(slotStart, slotEnd, bStart, bEnd)) {
            isProAvailable = false;
            break;
          }
        }
      }

      if (isProAvailable) {
        availableProIds.push(pro.id);
      }
    }

    slots.push({
      time: timeStr,
      available: availableProIds.length > 0,
      availableProIds: availableProIds,
      reason: availableProIds.length > 0 ? undefined : 'occupied'
    });
  }

  return slots;
}
