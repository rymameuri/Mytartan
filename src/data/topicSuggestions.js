/**
 * Sidebar topic suggestions — keep in sync with knowledge-base/.
 *
 * When you add or expand KB content (especially under knowledge-base/mycmuq/),
 * add a matching entry here so students can discover it. Each item's `prompt`
 * should mirror how students naturally ask; `kbPath` helps maintainers find
 * the source file (optional, not shown in UI).
 *
 * Also update knowledge-base/mycmuq/index.json `topicSuggestions` count when
 * sections change.
 */

export const TOPIC_SUGGESTIONS = [
  {
    title: "Your Studies",
    items: [
      {
        label: "Course registration",
        prompt: "How do I register for courses at CMU-Q?",
        kbPath: "mycmuq/offices/education-office/registration-records/course-registration.txt",
      },
      {
        label: "Plan your schedule",
        prompt: "How do I plan my course schedule at CMU-Q?",
        kbPath: "studies/plan-course-schedule.txt",
      },
      {
        label: "Cross registration",
        prompt: "How does cross registration work at Education City?",
        kbPath: "mycmuq/offices/education-office/registration-records/course-registration.txt",
      },
      {
        label: "Minors",
        prompt: "How do I declare a minor at CMU-Q?",
        kbPath: "mycmuq/offices/education-office/academic-programs/minors.txt",
      },
      {
        label: "Certificates",
        prompt: "What certificate programs are offered at CMU-Q?",
        kbPath: "mycmuq/offices/education-office/academic-programs/certificates.txt",
      },
      {
        label: "StuCo & micro courses",
        prompt: "What is StuCo at CMU-Q and how do micro courses work?",
        kbPath: "mycmuq/offices/education-office/academic-programs/stuco.txt",
      },
      {
        label: "Academic calendar",
        prompt: "Where can I find the CMU-Q academic calendar and exam schedules?",
        kbPath: "mycmuq/offices/education-office/registration-records/calendars-schedules.txt",
      },
      {
        label: "Supplemental Instruction",
        prompt: "What is Supplemental Instruction at the Academic Resource Center?",
        kbPath: "mycmuq/offices/education-office/academic-resource-center/supplemental-instruction.txt",
      },
      {
        label: "Awards & honors",
        prompt: "What academic awards and honors can CMU-Q students earn?",
        kbPath: "mycmuq/offices/education-office/awards-and-honors/student-academic-achievement-awards.txt",
      },
    ],
  },
  {
    title: "Campus IT & Computing",
    items: [
      {
        label: "Connect to WiFi",
        prompt: "How do I connect to CMUQ-SECURE WiFi?",
        kbPath: "mycmuq/offices/computing-services/services-how-tos/connect-to-wifi.txt",
      },
      {
        label: "VPN setup",
        prompt: "How do I set up VPN to access CMU-Q resources?",
        kbPath: "mycmuq/offices/computing-services/services-how-tos/vpn-setup-guide.txt",
      },
      {
        label: "Password & 2FA",
        prompt: "How do I reset my Andrew password and set up Duo 2FA?",
        kbPath: "mycmuq/offices/computing-services/services-how-tos/password-management.txt",
      },
      {
        label: "Campus printing",
        prompt: "How does campus printing work and where are the printers?",
        kbPath: "mycmuq/offices/computing-services/services-how-tos/printing-services.txt",
      },
      {
        label: "Canvas for students",
        prompt: "How do I use Canvas to submit assignments and check grades?",
        kbPath: "mycmuq/offices/computing-services/services-how-tos/canvas-for-students.txt",
      },
      {
        label: "Microsoft 365",
        prompt: "How do I install and activate Microsoft 365 on my devices?",
        kbPath: "mycmuq/offices/computing-services/services-how-tos/microsoft-365-setup-guide.txt",
      },
      {
        label: "CMU-approved AI tools",
        prompt: "What CMU-approved AI tools can students use?",
        kbPath: "mycmuq/offices/computing-services/services-how-tos/artificial-intelligence.txt",
      },
      {
        label: "GPU & research computing",
        prompt: "How do I access GPU resources for research at CMU-Q?",
        kbPath: "mycmuq/offices/computing-services/services-how-tos/gpu-resources-guide.txt",
      },
    ],
  },
  {
    title: "Student Life & Wellness",
    items: [
      {
        label: "CaPS-Q counseling",
        prompt: "What mental health services does CaPS-Q offer?",
        kbPath: "mycmuq/offices/student-affairs/caps-q/caps-services.txt",
      },
      {
        label: "Health insurance",
        prompt: "How does student health insurance work at CMU-Q?",
        kbPath: "mycmuq/offices/student-affairs/health-wellness/health-insurance.txt",
      },
      {
        label: "Accommodations",
        prompt: "How do I request accommodations for mental health or learning disabilities?",
        kbPath: "mycmuq/offices/student-affairs/caps-q/accommodations-mental-health-learning-disabilities.txt",
      },
      {
        label: "QF student housing",
        prompt: "How much is QF student housing and how do I apply?",
        kbPath: "mycmuq/offices/student-affairs/international-student-support/qf-student-housing.txt",
      },
      {
        label: "Career tools",
        prompt: "What career tools like Handshake and VMock are available at CMU-Q?",
        kbPath: "mycmuq/offices/student-affairs/career-services/career-tools-resources.txt",
      },
      {
        label: "Resumes & cover letters",
        prompt: "Where can I find resume tips and sample resumes by major?",
        kbPath: "mycmuq/offices/student-affairs/career-services/resumes-cover-letters.txt",
      },
      {
        label: "Study abroad",
        prompt: "What study abroad options are available for CMU-Q students?",
        kbPath: "mycmuq/offices/student-affairs/study-abroad/external-study-abroad.txt",
      },
      {
        label: "Student clubs",
        prompt: "How do I start or register a student club at CMU-Q?",
        kbPath: "mycmuq/offices/student-affairs/student-government-clubs/club-guidelines.txt",
      },
    ],
  },
  {
    title: "Financial Aid & Records",
    items: [
      {
        label: "Financial aid & scholarships",
        prompt: "What financial aid and scholarships are available at CMU-Q?",
        kbPath: "mycmuq/offices/education-office/financial-aid/financial-aid.txt",
      },
      {
        label: "Tuition & fees",
        prompt: "How do I pay tuition and view my e-bill at CMU-Q?",
        kbPath: "mycmuq/offices/education-office/financial-aid/tuition-and-fees.txt",
      },
      {
        label: "Emergency loans & grants",
        prompt: "How do I apply for an emergency student loan or grant?",
        kbPath: "mycmuq/offices/education-office/financial-aid/emergency-student-loans-and-grants.txt",
      },
      {
        label: "Enrollment & transcripts",
        prompt: "How do I request enrollment verification or a transcript?",
        kbPath: "mycmuq/offices/education-office/financial-aid/enrollment-records.txt",
      },
      {
        label: "Enrollment holds",
        prompt: "What are registration holds and enrollment statuses at CMU-Q?",
        kbPath: "mycmuq/offices/education-office/financial-aid/enrollment-records.txt",
      },
    ],
  },
  {
    title: "Policies & Help",
    items: [
      {
        label: "Student handbook",
        prompt: "Where can I find CMU-Q student handbook resources and contacts?",
        kbPath: "help/student-handbook.txt",
      },
      {
        label: "Academic integrity",
        prompt: "What is CMU-Q's policy on academic integrity?",
        kbPath: "help/academic-policies/statement-on-academic-integrity.txt",
      },
      {
        label: "Grade appeals",
        prompt: "How do I appeal a grade or academic action at CMU-Q?",
        kbPath: "mycmuq/offices/education-office/academic-policies/grade-appeal-procedure.txt",
      },
      {
        label: "Computing help",
        prompt: "How do I contact Computing Services for IT support?",
        kbPath: "mycmuq/offices/computing-services/overview.txt",
      },
      {
        label: "Global learning trips",
        prompt: "How do I apply for a global learning trip?",
        kbPath: "mycmuq/offices/education-office/experiential-learning/global-learning-trip.txt",
      },
    ],
  },
];

/** Flat list of all prompts — useful for tests and smoke checks. */
export function getAllTopicPrompts() {
  return TOPIC_SUGGESTIONS.flatMap((section) => section.items.map((item) => item.prompt));
}
