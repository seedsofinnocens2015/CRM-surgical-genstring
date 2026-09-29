export const LOCATIONS = [
  "Delhi MN",
  "Ghaziabad",
  "Gurgaon",
  "Lucknow",
  "Kolkata",
  "Meerut",
  "Other",
];

export const TREATMENTS = [
  "Abdominal Pain",
  "Adenomyosis",
  "Azoospermia",
  "Endometriosis",
  "Fibroids",
  "Gynec",
  "Hysteroscopy/Uterus Removal",
  "IVF",
  "Laparoscopy",
  "Sperm Donor",
  "Uterus - Related Concerns",
  "HSG",
  "Cyst",
  "Other",
];

export const LEAD_SOURCES = [
  "Google Search Ads",
  "Facebook Ads",
  "Instagram Ads",
  "Website Enquiry",
  "WhatsApp",
  "WhatsApp Call",
  "Inbound Call",
  "Phone Call",
  "Doctor Referral"
];

export const SUB_DISPOSITIONS_MAP: Record<
  string,
  { disposition: string; validStatus: string }
> = {
  "Appointment Booked": {
    disposition: "Converted",
    validStatus: "Valid",
  },
  "Appointment Cancelled": {
    disposition: "Contacted",
    validStatus: "Valid",
  },
  "Busy": {
    disposition: "Contact Attempt",
    validStatus: "NA",
  },
  "Call Disconnected": {
    disposition: "Contact Attempt",
    validStatus: "NA",
  },
  "Callback _Hospital Visit": {
    disposition: "Contacted",
    validStatus: "Valid",
  },
  "Callback_Appointment": {
    disposition: "Contacted",
    validStatus: "Valid",
  },
  "Callback_First pitch": {
    disposition: "Contact Attempt",
    validStatus: "NA",
  },
  "Distance issue": {
    disposition: "Closed",
    validStatus: "Invalid",
  },
  "Duplicate Lead": {
    disposition: "Closed",
    validStatus: "Invalid",
  },
  "Financial Issue": {
    disposition: "Closed",
    validStatus: "Invalid",
  },
  "Gynec": {
    disposition: "Contacted",
    validStatus: "Valid",
  },
  "Invalid Number": {
    disposition: "Closed",
    validStatus: "Invalid",
  },
  "Job Enquiry": {
    disposition: "Closed",
    validStatus: "Invalid",
  },
  "Junk": {
    disposition: "Closed",
    validStatus: "Invalid",
  },
  "Marketing/Promotion Calls": {
    disposition: "Closed",
    validStatus: "Invalid",
  },
  "Not contactable Attempt done": {
    disposition: "Closed",
    validStatus: "NA",
  },
  "Not Interested Competition": {
    disposition: "Closed",
    validStatus: "Invalid",
  },
  "Not Looking for Treatment": {
    disposition: "Closed",
    validStatus: "Invalid",
  },
  "Not Interested For Now": {
    disposition: "Closed",
    validStatus: "Invalid",
  },
  "Not reachable": {
    disposition: "Contact Attempt",
    validStatus: "NA",
  },
  "Registered For surgery": {
    disposition: "Converted",
    validStatus: "Valid",
  },
  "Ringing": {
    disposition: "Contact Attempt",
    validStatus: "NA",
  },
  "Surgery confirmed": {
    disposition: "Converted",
    validStatus: "Valid",
  },
  "Surgery Completed": {
    disposition: "Converted",
    validStatus: "Valid",
  },
  "Switched off": {
    disposition: "Contact Attempt",
    validStatus: "NA",
  },
  "Teleconsultation Booked": {
    disposition: "Converted",
    validStatus: "Valid",
  },
  "Teleconsultation Done": {
    disposition: "Converted",
    validStatus: "Valid",
  },
  "Test Call": {
    disposition: "Closed",
    validStatus: "Invalid",
  },
  "Treatment Started-SOI": {
    disposition: "Closed",
    validStatus: "Invalid",
  },
  "Wrong Number": {
    disposition: "Closed",
    validStatus: "Invalid",
  },
  "IVF Query": {
    disposition: "Closed",
    validStatus: "Invalid",
  },
  "Visited Centre": {
    disposition: "Converted",
    validStatus: "Valid",
  },
};

export const SUB_DISPOSITIONS = Object.keys(SUB_DISPOSITIONS_MAP);

export const TELECONSULTATION_SLOTS = [
  "09:00 AM - 09:30 AM",
  "09:30 AM - 10:00 AM",
  "10:00 AM - 10:30 AM",
  "10:30 AM - 11:00 AM",
  "11:00 AM - 11:30 AM",
  "11:30 AM - 12:00 PM",
  "12:00 PM - 12:30 PM",
  "12:30 PM - 01:00 PM",
  "01:00 PM - 01:30 PM",
  "01:30 PM - 02:00 PM",
  "02:00 PM - 02:30 PM",
  "02:30 PM - 03:00 PM",
  "03:00 PM - 03:30 PM",
  "03:30 PM - 04:00 PM",
  "04:00 PM - 04:30 PM",
  "04:30 PM - 05:00 PM",
  "05:00 PM - 05:30 PM",
  "05:30 PM - 06:00 PM",
  "06:00 PM - 06:30 PM",
  "06:30 PM - 07:00 PM",
  "07:00 PM - 07:30 PM",
  "07:30 PM - 08:00 PM",
];

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Converts YYYY-MM-DD -> DD-MMM-YY (e.g. 2026-09-26 -> 26-Sep-26)
export function formatDateToDDMMMYY(isoStr: string): string {
  if (!isoStr) return "";
  const parts = isoStr.split("-");
  if (parts.length !== 3) return isoStr;
  const year = parts[0].slice(-2);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parts[2].padStart(2, "0");
  const mmm = MONTH_NAMES[monthIdx] || parts[1];
  return `${day}-${mmm}-${year}`;
}

// Converts DD-MMM-YY -> YYYY-MM-DD for native HTML date input
export function parseDDMMMYYToISO(formattedDate: string): string {
  if (!formattedDate) return "";
  const parts = formattedDate.split("-");
  if (parts.length !== 3) return "";
  const monthIdx = MONTH_NAMES.findIndex(
    (m) => m.toLowerCase() === parts[1].toLowerCase()
  );
  if (monthIdx === -1) return "";
  const monthStr = String(monthIdx + 1).padStart(2, "0");
  const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
  const day = parts[0].padStart(2, "0");
  return `${year}-${monthStr}-${day}`;
}

// Extracts Month (MMM-YY) from date string
export function getMonthFromDate(dateStr: string): string {
  if (!dateStr) return "";
  if (dateStr.includes("-")) {
    const parts = dateStr.split("-");
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      const monthIdx = parseInt(parts[1], 10) - 1;
      const mmm = MONTH_NAMES[monthIdx] || parts[1];
      const year = parts[0].slice(-2);
      return `${mmm}-${year}`;
    } else if (parts.length === 3) {
      // DD-MMM-YY
      return `${parts[1]}-${parts[2]}`;
    }
  }
  return "";
}

// Today formatted in DD-MMM-YY
export function getTodayDDMMMYY(): string {
  const d = new Date();
  const year = String(d.getFullYear()).slice(-2);
  const day = String(d.getDate()).padStart(2, "0");
  const mmm = MONTH_NAMES[d.getMonth()];
  return `${day}-${mmm}-${year}`;
}

// Current month formatted in MMM-YY
export function getCurrentMonthMMMYY(): string {
  const d = new Date();
  const year = String(d.getFullYear()).slice(-2);
  const mmm = MONTH_NAMES[d.getMonth()];
  return `${mmm}-${year}`;
}

// Real-time timestamp formatted e.g. "26-Sep-26, 02:22 PM"
export function getFormattedTimestamp(dateObj: Date = new Date()): string {
  const day = String(dateObj.getDate()).padStart(2, "0");
  const mmm = MONTH_NAMES[dateObj.getMonth()];
  const year = String(dateObj.getFullYear()).slice(-2);

  let hours = dateObj.getHours();
  const minutes = String(dateObj.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 hour should be 12
  const strHours = String(hours).padStart(2, "0");

  return `${day}-${mmm}-${year}, ${strHours}:${minutes} ${ampm}`;
}

// Trigger real-time sync across open tabs and inside the active session
export function notifyLeadUpdated() {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("surgical_crm_leads_updated", Date.now().toString());
      window.dispatchEvent(new Event("lead_updated"));
    } catch {
      // ignore storage errors
    }
  }
}
