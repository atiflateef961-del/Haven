import type { OrganizationSummary, DashboardNotification } from "@/lib/dashboard-summary";
import type { Hostel } from "@/lib/hostels";
import type { Student } from "@/lib/students";
import type { AvailableRoom } from "@/lib/room-availability";
import type { VisitorStudent, VisitorVisit } from "@/lib/visitors";
import type { Complaint, ComplaintStaff } from "@/lib/complaints";
import type { MaintenanceComplaint, MaintenanceOption, MaintenanceRequest, MaintenanceStaff } from "@/lib/maintenance";
import type { MessSchedule, MessStudent } from "@/lib/mess";
import type { ManagedStaff, StaffUser } from "@/lib/staff";
import type { BookingReview } from "@/lib/bookings";
import type { InvoiceSummary } from "@/lib/invoices";
import type { Building } from "@/lib/buildings";
import type { Floor } from "@/lib/floors";
import type { Room } from "@/lib/rooms";
import type { Bed } from "@/lib/beds";

/** Set false to return to API-only rendering. Non-empty API data always wins. */
export const DEMO_MODE = true;

export const demoOrganizationId = "00000000-0000-4000-8000-000000000001";
const hostelIds = [
  "00000000-0000-4000-8000-000000000011",
  "00000000-0000-4000-8000-000000000012",
  "00000000-0000-4000-8000-000000000013",
  "00000000-0000-4000-8000-000000000014",
];
const studentIds = Array.from({ length: 50 }, (_, index) => `00000000-0000-4000-8000-${String(index + 101).padStart(12, "0")}`);
const staffIds = Array.from({ length: 8 }, (_, index) => `00000000-0000-4000-8000-${String(index + 201).padStart(12, "0")}`);
const occupiedByHostel = [52, 50, 55, 49];
const invoiceTotals = [250000, 180000, 225000, 160000, 145000, 195000, 210000, 175000, 155000, 150200];
export const demoInvoicePaidAmounts = [250000, 0, 100000, 0, 145000, 0, 210000, 0, 0, 150200];
const demoCollectedTotal = demoInvoicePaidAmounts.reduce((total, amount) => total + amount, 0);

const demoStudentNames = {
  Male: ["Ahmed", "Bilal", "Usman", "Hamza", "Zain", "Hassan", "Ali", "Omar", "Daniyal", "Saad", "Farhan", "Ibrahim", "Adeel", "Haris", "Talha", "Rayan", "Muneeb", "Salman", "Taha", "Yousuf", "Shahzaib", "Asad", "Fahad", "Huzaifa", "Sameer"],
  Female: ["Ayesha", "Hira", "Sana", "Maryam", "Fatima", "Zainab", "Noor", "Maham", "Iqra", "Laiba", "Mehak", "Eman", "Anaya", "Khadija", "Alina", "Areeba", "Hafsa", "Sidra", "Mina", "Rabia", "Mishal", "Sadia", "Amna", "Kinza", "Nimra"],
};
const demoStudentLastNames = ["Khan", "Ahmed", "Malik", "Raza", "Hussain", "Iqbal", "Shah", "Ali", "Tariq", "Siddiqui", "Farooq", "Javed", "Qureshi", "Rashid", "Akhtar", "Nawaz", "Mirza", "Sheikh", "Butt", "Yousaf", "Aslam", "Chaudhry", "Abbasi", "Rehman", "Mahmood"];
const demoPrograms = ["BS Computer Science", "BBA", "MBBS", "Pharm-D", "BS Software Engineering"];
const demoRoster = [
  ...demoStudentNames.Male.map((firstName, index) => ({ firstName, gender: "Male" as const, index })),
  ...demoStudentNames.Female.map((firstName, index) => ({ firstName, gender: "Female" as const, index })),
];
export const demoStudents: Student[] = demoRoster.map(({ firstName, gender, index }, rosterIndex) => {
  const lastName = demoStudentLastNames[index];
  const birthYear = 2002 + (index % 5);
  const birthMonth = String((index % 12) + 1).padStart(2, "0");
  const birthDay = String((index % 25) + 1).padStart(2, "0");
  return {
    id: studentIds[rosterIndex], organizationId: demoOrganizationId,
    studentNumber: `HMS-26-${String(rosterIndex + 1).padStart(3, "0")}`,
    firstName, lastName,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${rosterIndex + 1}@example.test`,
    phone: `+92 300 ${String(1000000 + rosterIndex).slice(-7)}`,
    dateOfBirth: `${birthYear}-${birthMonth}-${birthDay}`,
    educationInstitution: "Haven College", educationProgram: demoPrograms[index % demoPrograms.length],
    educationYear: String((index % 5) + 1), gender, status: "ACTIVE",
    createdAt: new Date(Date.UTC(2026, 0, rosterIndex + 1, 9)).toISOString(),
  };
});

export const demoHostels: Hostel[] = [
  { id: hostelIds[0], organizationId: demoOrganizationId, name: "Aravalli Hostel", code: "ARV", address: "Model Town, Lahore", createdAt: "2026-11-01T09:00:00.000Z", organization: { name: "Haven University" } },
  { id: hostelIds[1], organizationId: demoOrganizationId, name: "Nilgiri Hostel", code: "NIL", address: "Gulberg, Lahore", createdAt: "2026-11-02T09:00:00.000Z", organization: { name: "Haven University" } },
  { id: hostelIds[2], organizationId: demoOrganizationId, name: "Vindhya Hostel", code: "VIN", address: "Satellite Town, Multan", createdAt: "2026-11-03T09:00:00.000Z", organization: { name: "Haven University" } },
  { id: hostelIds[3], organizationId: demoOrganizationId, name: "Satpura Hostel", code: "SAT", address: "University Road, Bahawalpur", createdAt: "2026-11-04T09:00:00.000Z", organization: { name: "Haven University" } },
];

export const demoBuildings: Building[] = hostelIds.flatMap((hostelId, hostelIndex) => [0, 1].map((buildingIndex) => ({
  id: `00000000-0000-4000-8000-${String(301 + hostelIndex * 2 + buildingIndex).padStart(12, "0")}`,
  hostelId, name: `${String.fromCharCode(65 + buildingIndex)} Block`, roomCount: buildingIndex === 0 ? 8 : 7,
})));
export const demoFloors: Floor[] = demoBuildings.map((building, index) => ({
  id: `00000000-0000-4000-8000-${String(401 + index).padStart(12, "0")}`,
  buildingId: building.id, number: 1,
}));
export const demoRooms: Room[] = demoFloors.flatMap((floor, floorIndex) => Array.from({ length: demoBuildings[floorIndex].roomCount }, (_, index) => ({
  id: `00000000-0000-4000-8000-${String(501 + demoBuildings.slice(0, floorIndex).reduce((sum, item) => sum + item.roomCount, 0) + index).padStart(12, "0")}`,
  floorId: floor.id, number: `1${String(index + 1).padStart(2, "0")}`, roomType: "Shared", description: null,
})));
export const demoBeds: Bed[] = demoRooms.flatMap((room, index) => Array.from({ length: 4 }, (_, bedIndex) => {
  const hostelIndex = Math.floor(index / 15);
  return {
    id: `00000000-0000-4000-8000-${String(701 + index * 4 + bedIndex).padStart(12, "0")}`,
    roomId: room.id, label: String.fromCharCode(65 + bedIndex), isActive: true,
    isOccupied: (index % 15) * 4 + bedIndex < occupiedByHostel[hostelIndex],
  };
}));
export const demoAvailableRooms: AvailableRoom[] = demoRooms.map((room, index) => {
  const hostelIndex = Math.floor(index / 15);
  const capacity = 4;
  const occupiedBeds = Math.min(capacity, Math.max(0, occupiedByHostel[hostelIndex] - (index % 15) * capacity));
  const freeBeds = capacity - occupiedBeds;
  const floor = demoFloors.find((item) => item.id === room.floorId)!;
  const building = demoBuildings.find((item) => item.id === floor.buildingId)!;
  return {
    id: room.id, number: room.number, roomType: room.roomType, capacity, occupiedBeds, freeBeds,
    status: occupiedBeds === 0 ? "Free" : freeBeds === 0 ? "Full" : "Partly occupied",
    floor: { id: floor.id, number: floor.number, building: { id: building.id, name: building.name } },
  };
});

export const demoOrganizationSummary: OrganizationSummary = {
  organizationId: demoOrganizationId, organizationName: "Haven University", currency: "PKR",
  hostels: demoHostels.length, buildings: demoBuildings.length, rooms: demoRooms.length,
  beds: demoBeds.length, occupiedBeds: occupiedByHostel.reduce((sum, value) => sum + value, 0),
  availableBeds: demoBeds.length - occupiedByHostel.reduce((sum, value) => sum + value, 0),
  occupancyRate: Math.round(206 / 240 * 1000) / 10, collectedLast30Days: demoCollectedTotal.toFixed(2),
  hostelOccupancy: demoHostels.map((hostel, index) => ({ hostelId: hostel.id, hostelName: hostel.name,
    beds: 60, occupiedBeds: occupiedByHostel[index], availableBeds: 60 - occupiedByHostel[index],
    occupancyRate: Math.round(occupiedByHostel[index] / 60 * 1000) / 10 })),
  students: demoStudents.length,
  recentRegistrations: demoStudents.slice(0, 6).map((student) => ({ id: student.id, firstName: student.firstName, lastName: student.lastName, createdAt: student.createdAt })),
  recentActivity: [
    { id: "demo-activity-1", action: "New complaint submitted", resourceType: "Mess", createdAt: "2026-11-17T09:30:00.000Z" },
    { id: "demo-activity-2", action: "Invoice payment recorded", resourceType: "Finance", createdAt: "2026-11-16T14:15:00.000Z" },
    { id: "demo-activity-3", action: "Room assignment updated", resourceType: "Aravalli Hostel", createdAt: "2026-11-15T11:05:00.000Z" },
    { id: "demo-activity-4", action: "Maintenance request assigned", resourceType: "Facilities", createdAt: "2026-11-14T10:20:00.000Z" },
    { id: "demo-activity-5", action: "Visitor checked in", resourceType: "Student services", createdAt: "2026-11-13T08:45:00.000Z" },
    { id: "demo-activity-6", action: "Student profile created", resourceType: "Admissions", createdAt: "2026-11-12T15:10:00.000Z" },
  ],
};

export const demoNotifications: DashboardNotification[] = [
  { id: "demo-notice-1", organizationId: demoOrganizationId, title: "4 invoices are due soon", body: "Review upcoming student payments.", status: "PENDING", readAt: null, emailStatus: "SENT", createdAt: "2026-11-17T09:00:00.000Z" },
  { id: "demo-notice-2", organizationId: demoOrganizationId, title: "2 overdue payments", body: "Two invoices need follow-up.", status: "PENDING", readAt: null, emailStatus: "SENT", createdAt: "2026-11-16T12:00:00.000Z" },
  { id: "demo-notice-3", organizationId: demoOrganizationId, title: "Mess rating dropped to 4.3", body: "Review this week’s meal feedback.", status: "SENT", readAt: "2026-11-16T16:00:00.000Z", emailStatus: "SENT", createdAt: "2026-11-15T13:00:00.000Z" },
  { id: "demo-notice-4", organizationId: demoOrganizationId, title: "Security patrol completed", body: "The evening checklist is complete.", status: "SENT", readAt: null, emailStatus: "SENT", createdAt: "2026-11-14T18:00:00.000Z" },
  { id: "demo-notice-5", organizationId: demoOrganizationId, title: "Hygiene audit passed", body: "Grade A recorded for Aravalli Hostel.", status: "SENT", readAt: "2026-11-13T10:00:00.000Z", emailStatus: "SENT", createdAt: "2026-11-13T09:00:00.000Z" },
];

export const demoMonthlyCollections = [
  { label: "Jun", amount: 425000 }, { label: "Jul", amount: 510000 }, { label: "Aug", amount: 625000 },
  { label: "Sep", amount: 710000 }, { label: "Oct", amount: 802000 }, { label: "Nov", amount: demoCollectedTotal },
];
export const demoMetricTrends = {
  hostels: [2, 2, 3, 3, 4, 4], buildings: [4, 5, 5, 6, 7, 8], rooms: [36, 40, 44, 48, 54, 60],
  beds: [144, 160, 176, 192, 216, 240], occupiedBeds: [118, 132, 147, 163, 184, 206],
  availableBeds: [26, 28, 29, 29, 32, 34], students: [6, 7, 7, 8, 9, 10], revenue: demoMonthlyCollections.map(({ amount }) => amount),
};

export const demoVisitorStudents: VisitorStudent[] = demoStudents.map(({ id, studentNumber, firstName, lastName }) => ({ id, studentNumber, firstName, lastName }));
export const demoVisitors: VisitorVisit[] = demoStudents.slice(0, 6).map((student, index) => ({
  id: `00000000-0000-4000-8000-${String(801 + index).padStart(12, "0")}`,
  visitAt: `2026-11-${String(17 - index).padStart(2, "0")}T${String(9 + index).padStart(2, "0")}:00:00.000Z`,
  purpose: ["Family visit", "Document drop-off", "Student meeting", "Personal visit", "Pickup", "Family visit"][index],
  status: index === 0 ? "PENDING" : "COMPLETED", visitor: { name: ["Omar Raza", "Nadia Khan", "Asif Hussain", "Rubina Malik", "Tariq Iqbal", "Sadia Noor"][index], phone: `0300-${String(7654321 + index).padStart(7, "0")}` },
  student: demoVisitorStudents[index],
}));

export const demoComplaintStaff: ComplaintStaff[] = staffIds.slice(0, 4).map((id, index) => ({ id, organizationId: demoOrganizationId, employeeNumber: `EMP-${String(index + 1).padStart(3, "0")}`, jobTitle: ["Warden", "Facilities Lead", "Mess Supervisor", "Security Officer"][index], user: { firstName: ["Imran", "Naveed", "Saima", "Khalid"][index], lastName: ["Qureshi", "Akhtar", "Bibi", "Mehmood"][index] } }));
export const demoComplaints: Complaint[] = [
  ["Dining hall water filter", "OPEN"], ["Room 204 light repair", "IN_PROGRESS"], ["Laundry area cleaning", "OPEN"], ["Wi-Fi signal on floor two", "IN_PROGRESS"],
  ["Gate entry timing", "OPEN"], ["Bathroom tap leakage", "RESOLVED"], ["Mess meal temperature", "OPEN"], ["Study room noise", "CLOSED"],
].map(([title, status], index) => ({ id: `00000000-0000-4000-8000-${String(901 + index).padStart(12, "0")}`, title, status,
  description: `${title} reported by a resident for follow-up by the hostel team.`, assignedStaffId: index % 2 ? demoComplaintStaff[index % demoComplaintStaff.length].id : null,
  createdAt: `2026-11-${String(17 - index).padStart(2, "0")}T10:00:00.000Z`, student: { id: demoStudents[index].id, organizationId: demoOrganizationId, studentNumber: demoStudents[index].studentNumber, firstName: demoStudents[index].firstName, lastName: demoStudents[index].lastName } } as Complaint));

export const demoMaintenanceHostels: MaintenanceOption[] = demoHostels.map(({ id, organizationId, name }) => ({ id, organizationId, name }));
export const demoMaintenanceStaff: MaintenanceStaff[] = demoComplaintStaff.map((member, index) => ({ id: member.id, employeeNumber: member.employeeNumber, user: member.user, hostelAssignments: [{ hostelId: hostelIds[index] }] }));
export const demoMaintenanceComplaints: MaintenanceComplaint[] = demoComplaints.map(({ id, title }) => ({ id, title, organizationId: demoOrganizationId }));
export const demoMaintenanceRequests: MaintenanceRequest[] = [
  "Replace corridor bulb", "Repair water pump", "Fix room window latch", "Inspect dining exhaust", "Service generator", "Repair bathroom tap", "Repaint study room",
].map((title, index) => ({ id: `00000000-0000-4000-8000-${String(1001 + index).padStart(12, "0")}`, hostelId: hostelIds[index % 4], title,
  description: `${title} reported during the November facilities round.`, status: ["OPEN", "ASSIGNED", "IN_PROGRESS", "COMPLETED"][index % 4] as MaintenanceRequest["status"],
  complaintId: index < 4 ? demoComplaints[index].id : null, assigneeId: index % 3 ? demoMaintenanceStaff[index % 4].id : null,
  createdAt: `2026-11-${String(17 - index).padStart(2, "0")}T08:00:00.000Z`, complaint: index < 4 ? { title: demoComplaints[index].title, student: { userId: null, firstName: demoStudents[index].firstName, lastName: demoStudents[index].lastName, studentNumber: demoStudents[index].studentNumber } } : null,
  assignee: index % 3 ? { employeeNumber: demoMaintenanceStaff[index % 4].employeeNumber, user: demoMaintenanceStaff[index % 4].user } : null, hostel: { name: demoHostels[index % 4].name } }));

export const demoMessStudents: MessStudent[] = demoStudents.map((student, index) => ({ id: student.id, studentNumber: student.studentNumber, firstName: student.firstName, lastName: student.lastName, hostelIds: [hostelIds[index % 4]] }));
export const demoMessSchedules: MessSchedule[] = Array.from({ length: 21 }, (_, index) => {
  const day = 17 - Math.floor(index / 3);
  const mealIndex = index % 3;
  const mealType: MessSchedule["mealType"] = (["BREAKFAST", "LUNCH", "DINNER"] as const)[mealIndex];
  const startHour = [8, 13, 20][mealIndex];
  const dayKey = String(day).padStart(2, "0");
  const hostelStudents = demoMessStudents.filter((student) => student.hostelIds.includes(hostelIds[0]));
  return { id: `00000000-0000-4000-8000-${String(1101 + index).padStart(12, "0")}`, hostelId: hostelIds[0], mealType,
    startsAt: `2026-11-${dayKey}T${String(startHour).padStart(2, "0")}:00:00.000Z`, endsAt: `2026-11-${dayKey}T${String(startHour + 1).padStart(2, "0")}:00:00.000Z`,
    menu: ["Anda paratha, chai, seasonal fruit", "Chicken pulao, raita, salad", "Daal chawal, achar, kheer"][mealIndex], hostel: { name: demoHostels[0].name },
    attendance: hostelStudents.slice(0, 1 + index % hostelStudents.length).map((student, row) => ({ studentId: student.id, attendedAt: `2026-11-${dayKey}T${String(startHour).padStart(2, "0")}:${String(row).padStart(2, "0")}:00.000Z` })) };
});

export const demoStaffUsers: StaffUser[] = staffIds.map((id, index) => ({ id, firstName: ["Imran", "Naveed", "Saima", "Khalid", "Farah", "Javed", "Sadia", "Rashid"][index], lastName: ["Qureshi", "Akhtar", "Bibi", "Mehmood", "Siddiqui", "Butt", "Noor", "Chaudhry"][index], email: `staff${index + 1}@example.test`, memberships: [{ organizationId: demoOrganizationId }] }));
export const demoStaff: ManagedStaff[] = demoStaffUsers.map((user, index) => ({ id: user.id, organizationId: demoOrganizationId, userId: user.id, employeeNumber: `EMP-${String(index + 1).padStart(3, "0")}`, jobTitle: ["Resident Warden", "Facilities Manager", "Mess Supervisor", "Security Officer", "Accountant", "Housekeeping Lead", "Receptionist", "Maintenance Technician"][index], user: { firstName: user.firstName, lastName: user.lastName, email: user.email }, hostelAssignments: [{ hostelId: hostelIds[index % 4], hostel: { name: demoHostels[index % 4].name } }] }));

export const demoBookings: BookingReview[] = demoStudents.slice(0, 6).map((student, index) => ({ id: `00000000-0000-4000-8000-${String(1201 + index).padStart(12, "0")}`,
  requestedFrom: `2026-11-${String(18 + index).padStart(2, "0")}T00:00:00.000Z`, requestedUntil: `2026-11-${String(23 + index).padStart(2, "0")}T00:00:00.000Z`,
  status: ["APPROVED", "APPROVED", "FULFILLED", "FULFILLED", "REJECTED", "APPROVED"][index] as BookingReview["status"], notes: null, createdAt: `2026-11-${String(12 + index).padStart(2, "0")}T09:00:00.000Z`,
  student: { id: student.id, studentNumber: student.studentNumber, firstName: student.firstName, lastName: student.lastName, organization: { id: demoOrganizationId, name: "Haven University" } } }));

export const demoInvoices: InvoiceSummary[] = demoStudents.slice(0, invoiceTotals.length).map((student, index) => ({ id: `00000000-0000-4000-8000-${String(1301 + index).padStart(12, "0")}`,
  number: `HMS-INV-2026-${String(index + 1).padStart(4, "0")}`, status: ["PAID", "ISSUED", "PARTIALLY_PAID", "OVERDUE", "PAID", "ISSUED", "PAID", "OVERDUE", "ISSUED", "PAID"][index],
  currency: "PKR", totalAmount: invoiceTotals[index].toFixed(2), issuedAt: `2026-11-${String(index + 1).padStart(2, "0")}T09:00:00.000Z`, dueAt: `2026-11-${String(10 + index).padStart(2, "0")}T23:59:00.000Z`, createdAt: `2026-11-${String(index + 1).padStart(2, "0")}T09:00:00.000Z`,
  student: { id: student.id, studentNumber: student.studentNumber, firstName: student.firstName, lastName: student.lastName, organization: { id: demoOrganizationId, name: "Haven University" } } }));

export function getDemoInvoiceDetail(id: string) {
  const index = demoInvoices.findIndex((invoice) => invoice.id === id);
  const invoice = demoInvoices[index];
  if (!invoice) return null;
  const paidAmount = demoInvoicePaidAmounts[index];
  const amount = Number(invoice.totalAmount);
  return {
    ...invoice,
    paidAmount: paidAmount.toFixed(2),
    balanceDue: (amount - paidAmount).toFixed(2),
    items: [{ id: `${invoice.id}-item`, description: "Hostel accommodation · November 2026", quantity: "1", unitAmount: invoice.totalAmount, lineAmount: invoice.totalAmount }],
    payments: paidAmount > 0 ? [{ id: `${invoice.id}-payment`, amount: paidAmount.toFixed(2), currency: "PKR", method: "Bank transfer", status: "COMPLETED" }] : [],
  };
}
