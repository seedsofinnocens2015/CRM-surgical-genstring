"use client";

import React from "react";
import { Hash } from "lucide-react";

interface LeadTableCellProps {
  colId: string;
  lead: any;
  leadId: string;
}

export function renderLeadTableCell({ colId, lead }: LeadTableCellProps) {
  switch (colId) {
    case "patientName":
      return (
        <td key={colId} className="px-4 py-3.5 font-semibold text-black group-hover:text-[#cc2727] transition-colors">
          {lead.patientName || "-"}
        </td>
      );

    case "patientAge":
      return (
        <td key={colId} className="px-4 py-3.5 font-mono text-black">
          {lead.patientAge || "-"}
        </td>
      );

    case "location":
      return (
        <td key={colId} className="px-4 py-3.5 text-black">
          {lead.location || lead.otherCity || "-"}
        </td>
      );

    case "spouseName":
      return (
        <td key={colId} className="px-4 py-3.5 text-black">
          {lead.spouseName || "-"}
        </td>
      );

    case "spouseAge":
      return (
        <td key={colId} className="px-4 py-3.5 font-mono text-gray-500">
          {lead.spouseAge || "-"}
        </td>
      );

    case "date":
      return (
        <td key={colId} className="px-4 py-3.5 font-mono text-black">
          {lead.date || lead.dateOfLead || "-"}
        </td>
      );

    case "leadTimestamp":
      return (
        <td key={colId} className="px-4 py-3.5 font-mono text-[#cc2727] text-[11px]">
          {lead.leadTimestamp ||
            (lead.createdAt
              ? new Date(lead.createdAt).toLocaleString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })
              : lead.date || "-")}
        </td>
      );

    case "mobileNumber":
      return (
        <td key={colId} className="px-4 py-3.5 font-mono text-black">
          {lead.mobileNumber || lead.phoneNumber || "-"}
        </td>
      );

    case "alternateNumber":
      return (
        <td key={colId} className="px-4 py-3.5 font-mono text-gray-500">
          {lead.alternateNumber || "-"}
        </td>
      );

    case "callerName":
      return (
        <td key={colId} className="px-4 py-3.5 text-black">
          {lead.callerName || "-"}
        </td>
      );

    case "leadSource":
      return (
        <td key={colId} className="px-4 py-3.5 text-gray-500">
          {lead.leadSource || "-"}
        </td>
      );

    case "referredBy":
      return (
        <td key={colId} className="px-4 py-3.5 text-gray-500">
          {lead.referredBy || "-"}
        </td>
      );

    case "lookingForTreatment":
      return (
        <td key={colId} className="px-4 py-3.5 text-black font-medium">
          {lead.lookingForTreatment || lead.treatmentRequired || lead.treatment || "-"}
        </td>
      );

    case "treatmentRequirements":
      return (
        <td key={colId} className="px-4 py-3.5 text-gray-500 truncate max-w-[160px]" title={lead.treatmentRequirements || lead.treatmentRequired}>
          {lead.treatmentRequirements || lead.treatmentRequired || "-"}
        </td>
      );

    case "preConditions":
      return (
        <td key={colId} className="px-4 py-3.5 text-gray-500 truncate max-w-[160px]" title={lead.preConditions || lead.preCondition}>
          {lead.preConditions || lead.preCondition || "-"}
        </td>
      );

    case "surgeryDetails":
      return (
        <td key={colId} className="px-4 py-3.5 text-gray-500 truncate max-w-[160px]" title={lead.surgeryDetails || lead.surgicalData}>
          {lead.surgeryDetails || lead.surgicalData || "-"}
        </td>
      );

    case "followUpDate":
      return (
        <td key={colId} className="px-4 py-3.5 font-mono text-black">
          {lead.followUpDate || lead.followUpDates || "-"}
        </td>
      );

    case "subDispositions":
      return (
        <td key={colId} className="px-4 py-3.5 text-black">
          {lead.subDispositions || lead.subDisposition || "-"}
        </td>
      );

    case "dispositions":
      return (
        <td key={colId} className="px-4 py-3.5">
          {lead.dispositions || lead.disposition ? (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20">
              {lead.dispositions || lead.disposition}
            </span>
          ) : (
            "-"
          )}
        </td>
      );

    case "validStatus":
      return (
        <td key={colId} className="px-4 py-3.5">
          {lead.validStatus ? (
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                lead.validStatus === "Valid"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200/20"
                  : lead.validStatus === "Invalid"
                  ? "bg-rose-500/10 text-rose-300 border-rose-500/20"
                  : "bg-slate-700/30 text-gray-500 border-slate-300/50"
              }`}
            >
              {lead.validStatus}
            </span>
          ) : (
            "-"
          )}
        </td>
      );

    case "appointmentDate":
      return (
        <td key={colId} className="px-4 py-3.5 font-mono text-black">
          {lead.appointmentDate || "-"}
        </td>
      );

    case "appointmentMonth":
      return (
        <td key={colId} className="px-4 py-3.5 font-mono text-gray-500">
          {lead.appointmentMonth || "-"}
        </td>
      );

    case "teleconsultationSlot":
      return (
        <td key={colId} className="px-4 py-3.5 font-mono text-black">
          {lead.teleconsultationSlot || lead.appointmentSlot || "-"}
        </td>
      );

    case "consultationCharges":
      return (
        <td key={colId} className="px-4 py-3.5 font-mono text-emerald-700">
          {lead.consultationCharges || lead.teleConsultationCharges
            ? `₹${lead.consultationCharges || lead.teleConsultationCharges}`
            : "-"}
        </td>
      );

    case "surgeryDate":
      return (
        <td key={colId} className="px-4 py-3.5 font-mono text-black">
          {lead.surgeryDate || "-"}
        </td>
      );

    case "surgeryCost":
      return (
        <td key={colId} className="px-4 py-3.5 font-mono text-[#cc2727] font-semibold">
          {lead.surgeryCost ? `₹${lead.surgeryCost}` : "-"}
        </td>
      );

    case "surgeryPaymentReceived":
      return (
        <td key={colId} className="px-4 py-3.5 font-mono text-emerald-700">
          {lead.surgeryPaymentReceived || lead.surgeryReceipt
            ? `₹${lead.surgeryPaymentReceived || lead.surgeryReceipt}`
            : "-"}
        </td>
      );

    case "notes":
      return (
        <td key={colId} className="px-4 py-3.5 text-gray-500 truncate max-w-[200px]" title={lead.notes}>
          {lead.notes || "-"}
        </td>
      );

    default:
      return (
        <td key={colId} className="px-4 py-3.5 text-black">
          {lead[colId] || "-"}
        </td>
      );
  }
}
