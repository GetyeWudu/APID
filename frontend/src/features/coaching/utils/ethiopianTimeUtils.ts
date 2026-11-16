/**
 * Ethiopian Local Time System (የኢትዮጵያ ሰዓት አቆጣጠር)
 *
 * In Ethiopia, the 12-hour clock begins at sunrise:
 * - 06:00 AM EAT (UTC+3) = 12:00 ጠዋት (Morning)
 * - 07:00 AM EAT = 01:00 ጠዋት
 * - 12:00 PM EAT = 06:00 ቀን (Noon/Midday)
 * - 15:00 (03:00 PM EAT) = 09:00 ከሰዓት (Afternoon)
 * - 18:00 (06:00 PM EAT) = 12:00 ማታ (Sunset/Evening)
 * - 19:00 (07:00 PM EAT) = 01:00 ምሽት
 * - 00:00 (12:00 AM EAT) = 06:00 ለሊት (Midnight)
 */

export interface EthiopianTimeParts {
  ethiopianHour: number;
  minute: number;
  periodAmharic: string;
  periodEnglish: string;
  eatHour24: number;
  eatHour12: number;
  eatAmPm: 'AM' | 'PM';
  formattedDual: string;
}

/**
 * Converts a 24-hour time string ("HH:mm" or "HH:mm:ss") or Date to Ethiopian local time parts
 */
export function toEthiopianTime(time: string | Date): EthiopianTimeParts {
  let eatHour24 = 0;
  let minute = 0;

  if (time instanceof Date) {
    eatHour24 = time.getUTCHours() + 3; // Convert UTC to EAT (UTC+3)
    if (eatHour24 >= 24) eatHour24 -= 24;
    minute = time.getUTCMinutes();
  } else if (typeof time === 'string') {
    if (time.includes('T')) {
      // ISO String
      const d = new Date(time);
      eatHour24 = d.getUTCHours() + 3;
      if (eatHour24 >= 24) eatHour24 -= 24;
      minute = d.getUTCMinutes();
    } else {
      const parts = time.split(':').map((p) => parseInt(p, 10));
      eatHour24 = isNaN(parts[0]) ? 9 : parts[0];
      minute = isNaN(parts[1]) ? 0 : parts[1];
    }
  }

  // Calculate 12-hour EAT
  const eatHour12 = eatHour24 % 12 === 0 ? 12 : eatHour24 % 12;
  const eatAmPm: 'AM' | 'PM' = eatHour24 >= 12 ? 'PM' : 'AM';

  // Calculate Ethiopian 12-hour clock (sunrise offset: subtract 6 hours modulo 12)
  let ethH = (eatHour24 - 6) % 12;
  if (ethH <= 0) ethH += 12;

  // Determine period
  let periodAmharic = 'ጠዋት';
  let periodEnglish = 'Morning';

  if (eatHour24 >= 6 && eatHour24 < 12) {
    periodAmharic = 'ጠዋት';
    periodEnglish = 'Morning';
  } else if (eatHour24 >= 12 && eatHour24 < 18) {
    periodAmharic = 'ከሰዓት';
    periodEnglish = 'Afternoon';
  } else if (eatHour24 >= 18 && eatHour24 < 23) {
    periodAmharic = 'ማታ';
    periodEnglish = 'Evening';
  } else {
    periodAmharic = 'ለሊት';
    periodEnglish = 'Night';
  }

  const mm = minute.toString().padStart(2, '0');
  const ethHPad = ethH.toString().padStart(2, '0');
  const eatHPad = eatHour12.toString().padStart(2, '0');

  // Formatted dual display e.g. "09:00 ከሰዓት (03:00 PM EAT)"
  const formattedDual = `${ethHPad}:${mm} ${periodAmharic} (${eatHPad}:${mm} ${eatAmPm} EAT)`;

  return {
    ethiopianHour: ethH,
    minute,
    periodAmharic,
    periodEnglish,
    eatHour24,
    eatHour12,
    eatAmPm,
    formattedDual,
  };
}

/**
 * Standard Bank operating time options covering working hours and Saturday branch operations
 */
export interface StandardTimeOption {
  timeValue24: string; // "15:00"
  labelDual: string;   // "09:00 ከሰዓት (03:00 PM EAT)"
  ethiopianLabel: string; // "09:00 ከሰዓት"
  eatLabel: string;       // "03:00 PM EAT"
}

export const BANK_OPERATING_TIME_OPTIONS: StandardTimeOption[] = [
  // Morning working hours
  { timeValue24: '08:00', labelDual: '02:00 ጠዋት (08:00 AM EAT)', ethiopianLabel: '02:00 ጠዋት', eatLabel: '08:00 AM' },
  { timeValue24: '08:30', labelDual: '02:30 ጠዋት (08:30 AM EAT)', ethiopianLabel: '02:30 ጠዋት', eatLabel: '08:30 AM' },
  { timeValue24: '09:00', labelDual: '03:00 ጠዋት (09:00 AM EAT)', ethiopianLabel: '03:00 ጠዋት', eatLabel: '09:00 AM' },
  { timeValue24: '09:30', labelDual: '03:30 ጠዋት (09:30 AM EAT)', ethiopianLabel: '03:30 ጠዋት', eatLabel: '09:30 AM' },
  { timeValue24: '10:00', labelDual: '04:00 ጠዋት (10:00 AM EAT)', ethiopianLabel: '04:00 ጠዋት', eatLabel: '10:00 AM' },
  { timeValue24: '10:30', labelDual: '04:30 ጠዋት (10:30 AM EAT)', ethiopianLabel: '04:30 ጠዋት', eatLabel: '10:30 AM' },
  { timeValue24: '11:00', labelDual: '05:00 ጠዋት (11:00 AM EAT)', ethiopianLabel: '05:00 ጠዋት', eatLabel: '11:00 AM' },
  { timeValue24: '11:30', labelDual: '05:30 ጠዋት (11:30 AM EAT)', ethiopianLabel: '05:30 ጠዋት', eatLabel: '11:30 AM' },

  // Midday
  { timeValue24: '12:00', labelDual: '06:00 ቀን (12:00 PM EAT)', ethiopianLabel: '06:00 ቀን', eatLabel: '12:00 PM' },
  { timeValue24: '12:30', labelDual: '06:30 ቀን (12:30 PM EAT)', ethiopianLabel: '06:30 ቀን', eatLabel: '12:30 PM' },
  { timeValue24: '13:00', labelDual: '07:00 ከሰዓት (01:00 PM EAT)', ethiopianLabel: '07:00 ከሰዓት', eatLabel: '01:00 PM' },

  // Afternoon & post-branch closing / training windows
  { timeValue24: '14:00', labelDual: '08:00 ከሰዓት (02:00 PM EAT)', ethiopianLabel: '08:00 ከሰዓት', eatLabel: '02:00 PM' },
  { timeValue24: '14:30', labelDual: '08:30 ከሰዓት (02:30 PM EAT)', ethiopianLabel: '08:30 ከሰዓት', eatLabel: '02:30 PM' },
  { timeValue24: '15:00', labelDual: '09:00 ከሰዓት (03:00 PM EAT)', ethiopianLabel: '09:00 ከሰዓት', eatLabel: '03:00 PM' },
  { timeValue24: '15:30', labelDual: '09:30 ከሰዓት (03:30 PM EAT)', ethiopianLabel: '09:30 ከሰዓት', eatLabel: '03:30 PM' },
  { timeValue24: '16:00', labelDual: '10:00 ከሰዓት (04:00 PM EAT)', ethiopianLabel: '10:00 ከሰዓት', eatLabel: '04:00 PM' },
  { timeValue24: '16:30', labelDual: '10:30 ከሰዓት (04:30 PM EAT)', ethiopianLabel: '10:30 ከሰዓት', eatLabel: '04:30 PM' },
  { timeValue24: '17:00', labelDual: '11:00 ከሰዓት (05:00 PM EAT)', ethiopianLabel: '11:00 ከሰዓት', eatLabel: '05:00 PM' },
  { timeValue24: '17:30', labelDual: '11:30 ከሰዓት (05:30 PM EAT)', ethiopianLabel: '11:30 ከሰዓት', eatLabel: '05:30 PM' },
  { timeValue24: '18:00', labelDual: '12:00 ማታ (06:00 PM EAT)', ethiopianLabel: '12:00 ማታ', eatLabel: '06:00 PM' },
];

